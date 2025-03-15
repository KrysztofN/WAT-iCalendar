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

function handleGroupSelection(){
    const dropdown = document.getElementById('group-select');
    dropdown.addEventListener('change', (event) => {
        const selectedGroup = event.target.value;
        if(selectedGroup) {
            console.log(selectedGroup);
        }
    })
}

function setupDownloadButton() {
    const downloadButton = document.querySelector('button.step');
    
    downloadButton.addEventListener('click', () => {
        window.location.href = '/api/download-calendar';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndPopulateGroups();
    handleGroupSelection();
    setupDownloadButton();
});