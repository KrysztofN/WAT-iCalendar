async function fetchAndPopulateGroups(){
    try{
        const dropdown = document.getElementById('group-select');
        dropdown.innerHTML = '<option value="">Ładowanie danych...</option>';

        const lastUpdateInfo = document.getElementById('last-update');

        const response = await fetch('/api/groups');

        const data = await response.json();
        const groups = data.groups;

        dropdown.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '- Wybierz grupę -';
        dropdown.appendChild(defaultOption);

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.log(error.message);
    }
}

async function fetchAndPopulatePlans(){
    try {
        const response = await fetch('api/plans');
    } catch(err){
        console.log(err.message);
    }
}

let selectedGroup = null;

function handleGroupSelection(){
    const dropdown = document.getElementById('group-select');
    dropdown.addEventListener('change', (event) => {
        selectedGroup = event.target.value;
        document.querySelector('.QR-Code').style.display = 'none';
    })
}

function setupDownloadButton() {
    const downloadButton = document.querySelector('button.step1');
    
    downloadButton.addEventListener('click', () => {
        if(selectedGroup){
            window.location.href = '/api/download-calendar';
        } else{
            alert('Najpierw wybierz grupę');
        }
    });
}

function displayQR(){
    const generatedButton = document.querySelector('button.step2');
    
    generatedButton.addEventListener('click', () => {
        document.querySelector('.QR-Code').style.display = 'block';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndPopulateGroups();
    handleGroupSelection();
    setupDownloadButton();
    displayQR();
});