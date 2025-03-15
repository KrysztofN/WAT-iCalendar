const axios = require('axios');
const url = 'https://planzajec.wcy.wat.edu.pl/rozklad';
    axios(url)
        .then(response => {
            const html = response.data;
            console.log(html);
        })
        .catch(console.error);