const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const cors = require('cors');

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
        
        await fetchAndCachePlans(groupNames);
        return groupNames
    } catch(error){
        console.error('Error fetching groups:', error.message);
        throw error;
    }
}

async function extractGroupPlan(id) {
    const baseUrl = 'https://planzajec.wcy.wat.edu.pl/pl/rozklad?grupa_id=';
    const targetUrl = baseUrl.concat(id);
    
    try {
      console.log(`Fetching plan for group ${id}...`);
      const response = await axiosInstance.get(targetUrl);
      const html = response.data;
      const $ = cheerio.load(html);
      const groupPlan = {
        id: id,
        days: {}
      };
      
      $('.rozklad_container .day_v1').each((index, dayElement) => {
        const dayName = $(dayElement).find('.day_name span').text().trim();
        
        groupPlan.days[dayName] = {
          timeBlocks: [],
          dates: []
        };
        
        $(dayElement).find('.block_nr').each((blockIndex, blockElement) => {
          const blockNumber = $(blockElement).find('.nr').text().trim();
          const startTime = $(blockElement).find('.hr1').text().trim();
          const endTime = $(blockElement).find('.hr2').text().trim();
          
          groupPlan.days[dayName].timeBlocks.push({
            blockNumber: blockNumber,
            startTime: startTime,
            endTime: endTime
          });
        });
        
        $(dayElement).find('.days .day').each((dateIndex, dateElement) => {
          const dateClass = $(dateElement).attr('class');
          const dateMatch = dateClass ? dateClass.match(/(\d{4}_\d{2}_\d{2})/) : null;
          let dateString = '';
          
          if (dateMatch) {
            dateString = dateMatch[1].replace(/_/g, '-');
          }
          
          const day = $(dateElement).find('.date1').text().trim();
          const month = $(dateElement).find('.date2').text().trim();
          
          const dateObj = {
            date: dateString,
            displayDate: `${day} ${month}`,
            blocks: []
          };
          
          $(dateElement).find('.blocks .block').each((blockIndex, blockElement) => {
            if ($(blockElement).attr('style')) {
              const title = $(blockElement).attr('title') || '';
              const blockContent = $(blockElement).html() || '';
              
              const blockClass = $(blockElement).attr('class');
              const blockMatch = blockClass ? blockClass.match(/block(\d+)/) : null;
              const blockNumber = blockMatch ? blockMatch[1] : '';
              
              let courseName = '';
              let lectureType = '';
              let professor = '';
              let shortName = '';
              let room = '';
              let professorCode = '';
              
              if (title) {
                const titleParts = title.split(' - ');
                if (titleParts.length >= 1) courseName = titleParts[0].trim();
                if (titleParts.length >= 2) lectureType = titleParts[1].replace(/[\(\)]/g, '').trim();
                if (titleParts.length >= 3) professor = titleParts[2].trim();
              }
              
              if (blockContent) {
                const contentParts = blockContent.split('<br>');
                if (contentParts.length >= 1) shortName = contentParts[0].trim();
                
                if (contentParts.length >= 3) room = contentParts[2].trim();
                
                if (contentParts.length >= 4) {
                  const profCodeMatch = contentParts[3].match(/([A-Za-z]+)\[(\d+)\]/);
                  if (profCodeMatch) {
                    professorCode = profCodeMatch[0];
                  }
                }
              }
              
              const backgroundColor = $(blockElement).attr('style')
                ? $(blockElement).attr('style').match(/background-color:(#[A-Fa-f0-9]+)/)
                : null;
              const bgColor = backgroundColor ? backgroundColor[1] : '';
              
              dateObj.blocks.push({
                blockNumber: blockNumber,
                title: title,
                courseName: courseName,
                lectureType: lectureType,
                professor: professor,
                shortName: shortName,
                room: room,
                professorCode: professorCode,
                backgroundColor: bgColor,
                rawContent: blockContent.replace(/<br>/g, ' | ')
              });
            }
          });
          
          if (dateObj.blocks.length > 0) {
            groupPlan.days[dayName].dates.push(dateObj);
          }
        });
      });
      
      console.log(`Successfully fetched plan for group ${id}`);
      return groupPlan;
    } catch (error) {
      console.error(`Error extracting plan for group ${id}:`, error.message);
      throw error;
    }
  }

async function processBatch(groups, batchSize = 3, delayMs = 500) {
    const plans = {};
    
    for (let i = 0; i < groups.length; i += batchSize) {
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

function generateICalendar(){
    
}

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
            } catch (groupsError) {
                console.log('No groups cache found, fetching groups first');
                const groups = await fetchAndCacheGroups();
                const cacheData = await fs.readFile(PLAN_CACHE_FILE, 'utf8');
                plansData = JSON.parse(cacheData);
            }
        }

        res.json(plansData);
    } catch(err) {
        console.error('Error in /api/plans endpoint:', err.message);
        res.status(500).json({ error: 'Failed to retrieve plans' });
    }
});

app.get('/api/download-calendar', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'zajecie.ics');
    
    console.log('Attempting to serve file from:', filePath);
    
    fs.access(filePath, fs.constants.F_OK)
      .then(() => {
        res.download(filePath, 'zajecie.ics');
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

async function initializeCache() {
    try {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        } catch(err) {
            if (err.code !== 'EEXIST') throw err;
        }

        let needsUpdate = true;

        try {
            const cacheData = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
            const data = JSON.parse(cacheData);
            const cacheTime = new Date(data.timestamp);
            const now = new Date();

            if ((now - cacheTime) < 24 * 60 * 60 * 1000) {
                needsUpdate = false;
                console.log('Cache is still valid, skipping update');
            } else {
                console.log('Cache is older than 24 hours, will update');
            }
        } catch (readError) {
            console.log('No cache found, will create new cache');
        }

        if (needsUpdate) {
            await fetchAndCacheGroups();
        }
    } catch (error) {
        console.error('Error initializing cache:', error.message);
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeCache();
});