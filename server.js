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
const PLAN_CACHE_DIR = path.join(CACHE_DIR, 'plans-cache.json');

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
        const response = await axios.get(targetUrl);
        const html = response.data;
        const groupNames = extractGroupNames(html);
        
        try{
            await fs.mkdir(CACHE_DIR, {recursive: true})
        } catch(err){
            if (err.code !== 'EEXIST') throw err;
        }

        // Saving to cache
        const cacheData = {
            timestamp: new Date().toISOString(),
            groups: groupNames
        };

        await fs.writeFile(GROUP_CACHE_FILE, JSON.stringify(cacheData, null, 2));
        return groupNames
    } catch(error){
        console.error(error.message);
        throw error;
    }
}

app.get('/api/groups', async (req, res) => {
    try {
        try{
            await fs.mkdir(CACHE_DIR, {recursive: true})
        } catch(err){
            if (err.code !== 'EEXIST') throw err;
        }

        let groupsData;

        try {
            const cacheData = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
            groupsData = JSON.parse(cacheData);

        } catch (cacheError){
            // cache doesn't exist so we fetch it
            const groups = await fetchAndCacheGroups();
            groupsData = {
                timeStamp: new Date().toISOString(),
                groups: groups
            };
        }

        res.json(groupsData);
    } catch(err) {
        console.log(err.message);
    }
});

app.get('/api/download-calendar', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'zajecie.ics');
    
    console.log('Attempting to serve file from:', filePath);
    
    fs.access(filePath, fs.constants.F_OK)
      .then(() => {
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename="zajecie.ics"');
        res.sendFile(filePath);
      })
      .catch((err) => {
        console.error(`File not found: ${filePath}`, err);
      });
  } catch (error) {
    console.error('Error in download route:', error);
  }
});

async function initializeCache() {
    try {
        try{
            await fs.mkdir(CACHE_DIR, {recursive: true})
        } catch(err){
            if (err.code !== 'EEXIST') throw err;
        }

        let needsUpdate = true;

        const cacheData = await fs.readFile(GROUP_CACHE_FILE, 'utf8');
        const data = JSON.parse(cacheData);
        const cacheTime = new Date(data.timestamp);
        const now = new Date();

        if ((now - cacheTime) < 24 * 60 * 60 * 1000){
            needsUpdate = false;
        } 

        if (needsUpdate) {
            await fetchAndCacheGroups();
        }
    } catch (error){
        console.log(error.message);
    }
}


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeCache();
});
