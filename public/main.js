let selectedGroup = null;

function handleGroupSelection(){
    $('#group-select').on('select2:select', function (e) {
        selectedGroup = e.params.data.id; 
        document.querySelector('.QR-Code').style.display = 'none';
    });
}


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
        $('#group-select').select2({
            dropdownCssClass: 'safari-style',
        });
    } catch (error) {
        console.log(error.message);
    }
}

async function fetchAndPopulatePlans(){
    try {
        await fetch('api/plans');
    } catch(err){
        console.log(err.message);
    }
}


function downloadCalendar() {
    const downloadButton = document.querySelector('button.step1');
    
    downloadButton.addEventListener('click', () => {
        if(selectedGroup){
            window.location.href = `/api/download-calendar/${selectedGroup}`;
        } else{
            alert('Najpierw wybierz grupę');
        }
    });
}

function displayQR(){
    const generatedButton = document.querySelector('button.step2');
    
    generatedButton.addEventListener('click', () => {
        if(!selectedGroup){
            alert('Najpierw wybierz grupę');
        } else {

            const baseUrl = window.location.origin;
            
            const sanitizedGroupId = selectedGroup.replace(/[\\/:*?"<>|]/g, '_');

            const calendarUrl = `${baseUrl}/api/download-calendar/${sanitizedGroupId}`;
    
            document.querySelector('.QR-Code').style.display = 'block';
            
            document.getElementById("qrcode").innerHTML = '';
            new QRCode(document.getElementById("qrcode"), {
                text: calendarUrl,
                width: 128,
                height: 128,
            });

        }

    });

}

document.addEventListener('DOMContentLoaded', async () => {
    fetchAndPopulateGroups();
    fetchAndPopulatePlans();
    handleGroupSelection();
    downloadCalendar();
    displayQR();
});