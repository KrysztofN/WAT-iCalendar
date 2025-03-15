const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

const CACHE_DIR = path.join(__dirname, 'data');
const GROUP_CACHE_FILE = path.join(CACHE_DIR, 'groups-cache.json');
const PLAN_CACHE_DIR = path.join(CACHE_DIR, 'plans-cache.json');

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


fetchAndCacheGroups()
  .then(groupNames => {
    console.log('Found', groupNames.length, 'group names:');
    console.log(groupNames);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });