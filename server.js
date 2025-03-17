const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = path.join(__dirname, 'data');
const GROUP_CACHE_FILE = path.join(CACHE_DIR, 'groups-cache.json');
const PLAN_CACHE_FILE = path.join(CACHE_DIR, 'plans-cache.json');

const axiosInstance = axios.create({
  timeout: 30000, 
  headers: {
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

app.use(cors());
app.use(express.static('public'));

//  CACHE & FETCH FUNCTIONS
async function initializeCache() {
  try {
      try {
          await fs.mkdir(CACHE_DIR, { recursive: true });
      } catch(err) {
          if (err.code !== 'EEXIST') throw err;
      }

      let needsUpdateGroup = true;
      let needsUpdatePlan = true;
      let dataGroup = null;

      try {
          const cacheDataGroup = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
          const cacheDataPlan = await fs.readFile(PLAN_CACHE_FILE, 'utf8');
          dataGroup = JSON.parse(cacheDataGroup);
          const dataPlan = JSON.parse(cacheDataPlan);
          const cacheTimeGroup = new Date(dataGroup.timestamp);
          const cacheTimePlan = new Date(dataPlan.timestamp);
          const now = new Date();

          if ((now - cacheTimeGroup) < 24 * 60 * 60 * 1000) {
              needsUpdateGroup = false;
              console.log('Cache is still valid, skipping update');
          } 
          if ((now - cacheTimePlan) < 24 * 60 * 60 * 1000) {
              needsUpdatePlan = false;
              console.log('Cache is still valid, skipping update');
          } else {
              console.log('Cache is older than 24 hours, will update');
          }
      } catch (readError) {
          console.log('No cache found, will create new cache');
      }

      if (needsUpdateGroup) {
          const groups = await fetchAndCacheGroups();
          
          if (needsUpdatePlan) {
              const plans = await fetchAndCachePlans(groups);
              await generateIcsFiles(plans);

          }
      } else if (needsUpdatePlan) {
          const groups = dataGroup.groups;
          const plans = await fetchAndCachePlans(groups);
          await generateIcsFiles(plans);
      }

  } catch (error) {
      console.error('Error initializing cache:', error.message);
  }
}

function extractGroupNames(html) {
  const $ = cheerio.load(html);
  const groupNames = [];
  
  const options = $('.ctools-jump-menu-select option');
  
  options.each((index, element) => {
    const text = $(element).text().trim();
    
    if (text !== "- Wybierz grupę -") {
      if (text.includes('WCY')) {
        groupNames.push(text);
      }
    }
  });
  
  return groupNames;
}

async function fetchAndCacheGroups(){
    try{
        const targetUrl = 'https://planzajec.wcy.wat.edu.pl/rozklad'; 
        console.log(`Fetching HTML from ${targetUrl}...`);
        const response = await axiosInstance.get(targetUrl);
        const html = response.data;
        const groupNames = extractGroupNames(html);
        
        try{
            await fs.mkdir(CACHE_DIR, {recursive: true})
        } catch(err){
            if (err.code !== 'EEXIST') throw err;
        }

        const cacheData = {
            timestamp: new Date().toISOString(),
            groups: groupNames
        };

        await fs.writeFile(GROUP_CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log(`Successfully cached ${groupNames.length} groups`);
        
        return groupNames
    } catch(error){
        console.error('Error fetching groups:', error.message);
        throw error;
    }
}

async function extractGroupPlan(id) {
    const baseUrl = 'https://planzajec.wcy.wat.edu.pl/pl/rozklad?grupa_id=';
    const targetUrl = baseUrl.concat(id);
    
    let browser = null;
    
    try {
      console.log(`Fetching plan for group ${id} using Puppeteer...`);
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      await page.setDefaultNavigationTimeout(60000);
      
      await page.goto(targetUrl, { waitUntil: 'networkidle0' });
      
      await page.waitForSelector('.block_nr', { timeout: 10000 });
      
      const groupPlan = await page.evaluate(() => {
        const plan = {
          id: new URLSearchParams(window.location.search).get('grupa_id'),
          blocks: {},
          days: {}
        };
        
        document.querySelectorAll('.block_nr').forEach(element => {
          const blockClass = element.className;
          const blockMatch = blockClass.match(/block(\d+)/);
          if (blockMatch) {
            const blockNumber = blockMatch[1];
            const startTime = element.querySelector('.hr1')?.textContent || '';
            const endTime = element.querySelector('.hr2')?.textContent || '';
            
            plan.blocks[`block${blockNumber}`] = {
              number: blockNumber,
              startTime: startTime,
              endTime: endTime
            };
          }
        });
        
        document.querySelectorAll('.day_v1').forEach(dayContainer => {
          const dayName = dayContainer.querySelector('.day_name span')?.textContent || '';
          
          dayContainer.querySelectorAll('.days .day').forEach(dayElement => {
            const dayClass = dayElement.className;
            const dateMatch = dayClass.match(/(\d{4}_\d{2}_\d{2})/);
            
            if (dateMatch) {
              const dateString = dateMatch[1];
              const [year, month, day] = dateString.split('_');
              const formattedDate = `${year}-${month}-${day}`;
              
              plan.days[formattedDate] = {
                date: formattedDate,
                dayName: dayName,
                blocks: {}
              };
              
              dayElement.querySelectorAll('.blocks .block').forEach(blockElement => {
                const blockClass = blockElement.className;
                const blockMatch = blockClass.match(/block(\d+)/);
                
                if (blockMatch) {
                  const blockNumber = blockMatch[1];
                  const blockId = `block${blockNumber}`;
                  
                  const blockContent = blockElement.innerHTML;
                  const hasContent = blockContent && blockContent.trim() !== '';
                  
                  if (hasContent) {
                    const title = blockElement.getAttribute('title') || '';
                    
                    let subject = '', type = '', teacher = '';
                    
                    if (title) {
                      const titleParts = title.split(' - ');
                      subject = titleParts[0] || '';
                      type = titleParts[1] ? titleParts[1].replace(/[()]/g, '') : '';
                      teacher = titleParts[2] || '';
                    }

                    
                    const textLines = blockContent.split('<br>');
                    
                    const subjectCode = textLines[0] || ''
                    const typeShort = textLines[1] ? textLines[1].replace(/[()]/g, '') : '';
                    const room = textLines[2] || '';
                    const teacherShort = textLines[3] || '';
                    
                    plan.days[formattedDate].blocks[blockId] = {
                      blockNumber: blockNumber,
                      subject: subject,
                      type: type,
                      teacher: teacher,
                      subjectCode: subjectCode,
                      typeShort: typeShort,
                      room: room,
                      teacherShort: teacherShort,
                      title: title,
                      startTime: plan.blocks[blockId]?.startTime,
                      endTime: plan.blocks[blockId]?.endTime
                    };
                  } else {
                    plan.days[formattedDate].blocks[blockId] = {
                      blockNumber: blockNumber,
                      isEmpty: true,
                      startTime: plan.blocks[blockId]?.startTime,
                      endTime: plan.blocks[blockId]?.endTime
                    };
                  }
                }
              });
            }
          });
        });
        
        return plan;
      });
      
      return groupPlan;
      
    } catch (err) {
      console.error(`Error fetching plan for group ${id}:`, err.message);
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
}

async function processBatch(groups, batchSize = 1, delayMs = 1000) {
    const plans = {};
    
    for (let i = 110; i < groups.length-89; i += batchSize) {
        const batch = groups.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(groups.length/batchSize)} (${batch.join(', ')})`);
        
        const batchPromises = batch.map(async (group) => {
            try {
                const plan = await extractGroupPlan(group);
                return { group, plan };
            } catch (err) {
                console.log(`Error processing group ${group}:`, err.message);
                return { group, error: err.message };
            }
        });
        
        const results = await Promise.all(batchPromises);
        
        results.forEach(result => {
            if (result.plan) {
                plans[result.group] = result.plan;
            }
        });
        
        if (i + batchSize < groups.length) {
            console.log(`Waiting ${delayMs}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return plans;
}

async function fetchAndCachePlans(groups) {
    try {
        let existingPlans = {};
        try {
            const cacheData = await fs.readFile(PLAN_CACHE_FILE, 'utf8');
            const { plans } = JSON.parse(cacheData);
            existingPlans = plans || {};
            console.log(`Found ${Object.keys(existingPlans).length} existing plans in cache`);
        } catch (err) {
            console.log('No existing plans cache found, will create new cache');
        }
        
        const freshPlans = await processBatch(groups);
        
        const allPlans = { ...existingPlans, ...freshPlans };
        
        await fs.writeFile(
            PLAN_CACHE_FILE, 
            JSON.stringify(
                { timestamp: new Date().toISOString(), plans: allPlans },
                null, 
                2
            )
        );
        
        console.log(`Successfully cached ${Object.keys(allPlans).length} plans`);
        return allPlans;
    } catch (err) {
        console.log('Error in fetchAndCachePlans:', err.message);
        throw err;
    }
}

// ICS FILES GENERATION
function generateIcsFiles(plansData, outputDir = './calendars'){
    try {
      try {
        fs.mkdir(outputDir, {recursive : true});
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
  
      Object.keys(plansData).forEach(groupId => {
          const groupPlan = plansData[groupId];
          const icsContent = generateIcsContent(groupPlan, groupId);
  
          const filePath = path.join(outputDir, `${groupId}.ics`);
          fs.writeFile(filePath, icsContent);
      });
      
    } catch(err){
      console.log(err.message);
    }
}

function generateIcsContent(groupPlan, groupId){
  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WAT Schedule Generator//EN
CALSCALE:GREGORIAN
BEGIN:VTIMEZONE
TZID:Europe/Warsaw
LAST-MODIFIED:20240422T053451Z
TZURL:https://www.tzurl.org/zoneinfo-outlook/Europe/Warsaw
X-LIC-LOCATION:Europe/Warsaw
BEGIN:DAYLIGHT
TZNAME:CEST
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZNAME:CET
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE\n`;

  //Processing each day
  Object.keys(groupPlan.days).forEach(dateStr => {
      const day = groupPlan.days[dateStr]

      Object.keys(day.blocks).forEach(blockId => {
          const block = day.blocks[blockId];

          if (block.isEmpty){
            return;
          }

          const startDateTime = formatDateTime(dateStr, block.startTime);
          const endDateTime = formatDateTime(dateStr, block.endTime);

          const uid = `${groupId}-${dateStr}-${blockId}-${Math.random().toString(36).substring(2, 15)}`;

          const summary = `${block.subjectCode} (${block.typeShort}) - ${block.room}`

          const description = `Nazwa: ${block.subject}\\nTyp: ${block.type}\\nWykładowca: ${block.teacher}\\nSala: ${block.room}`;

          icsContent += `BEGIN:VEVENT
DTSTAMP:${formatTimeStamp(new Date())}
UID:${uid}
DTSTART;TZID=Europe/Warsaw:${startDateTime}
DTEND;TZID=Europe/Warsaw:${endDateTime}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT\n`;
      });
  }); 

  icsContent += 'END:VCALENDAR';
  return icsContent
}

function formatDateTime(dateStr, timeStr){
    const cleanDateStr = dateStr.replace(/-/g, '');
    const cleanTimeStr = timeStr.replace(/:/g, '');
    return `${cleanDateStr}T${cleanTimeStr}00`;
}

function formatTimeStamp(date){
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
}

// API ENDPOINTS
app.get('/api/groups', async (req, res) => {
    try {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        } catch(err) {
            if (err.code !== 'EEXIST') throw err;
        }

        let groupsData;

        try {
            const cacheData = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
            groupsData = JSON.parse(cacheData);
            console.log(`Retrieved ${groupsData.groups.length} groups from cache`);
        } catch (cacheError) {
            console.log('Cache miss for groups, fetching fresh data');
            const groups = await fetchAndCacheGroups();
            groupsData = {
                timestamp: new Date().toISOString(),
                groups: groups
            };
        }

        res.json(groupsData);
    } catch(err) {
        console.error('Error in /api/groups endpoint:', err.message);
        res.status(500).json({ error: 'Failed to retrieve groups' });
    }
});

app.get('/api/plans', async (req, res) => {
    try {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        } catch(err) {
            if (err.code !== 'EEXIST') throw err;
        }

        let plansData;

        try {
            const cacheData = await fs.readFile(PLAN_CACHE_FILE, 'utf8');
            plansData = JSON.parse(cacheData);
            console.log(`Retrieved ${Object.keys(plansData.plans).length} plans from cache`);
            // check if plans exist
        } catch (cacheError) {
            console.log('Cache miss for plans, fetching fresh data');
            try {
                const groupsData = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
                const { groups } = JSON.parse(groupsData);
                const plans = await fetchAndCachePlans(groups);
                plansData = {
                    timestamp: new Date().toISOString(),
                    plans: plans
                };
                await generateIcsFiles(plans);
            } catch (groupsError) {
                console.log('No groups cache found, fetching groups first');
                const groups = await fetchAndCacheGroups();
                const plans = await fetchAndCachePlans(groups);
                plansData = {
                  timestamp: new Date().toISOString(),
                  plans: plans
                };
                await generateIcsFiles(plans);
            }
        }
    } catch(err) {
        console.error('Error in /api/plans endpoint:', err.message);
        res.status(500).json({ error: 'Failed to retrieve plans' });
    }
});

app.get('/api/download-calendar/:group', (req, res) => {
  try {
    const group = req.params.group;
    const filePath = path.join(__dirname, 'calendars', `${group}.ics`);
    
    console.log('Attempting to serve file from:', filePath);
    
    fs.access(filePath, fs.constants.F_OK)
      .then(() => {
        res.download(filePath, `${group}.ics`);
      })
      .catch((err) => {
        console.error(`File not found: ${filePath}`, err);
        res.status(404).json({ error: 'Calendar file not found' });
      });
  } catch (error) {
    console.error('Error in download route:', error);
    res.status(500).json({ error: 'Failed to download calendar' });
  }
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeCache();
});