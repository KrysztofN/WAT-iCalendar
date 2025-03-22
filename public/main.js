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

// async function downloadWithProgress(url, bar, selectedGroup) {
//     const response = await fetch(url);
    
//     if (!response.ok) {
//         throw new Error(`Download failed: ${response.statusText}`);
//     }

//     const contentLength = response.headers.get('Content-Length');
//     if (!contentLength) {
//         console.warn("Content-Length header missing; can't track progress.");
//         bar.style.width = '100%';
//         bar.style.display = 'none';
//         return;
//     }

//     const totalBytes = parseInt(contentLength, 10);
//     let receivedBytes = 0;
//     const reader = response.body.getReader();
//     const chunks = [];

//     while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//         chunks.push(value);
//         receivedBytes += value.length;

//         const percent = Math.round((receivedBytes / totalBytes) * 100);
//         bar.style.width = `${percent}%`;
//     }

//     bar.style.width = '100%';
    
//     const blob = new Blob(chunks);
//     const urlObject = URL.createObjectURL(blob);
    
//     const a = document.createElement("a");
//     a.href = urlObject;
//     a.download = `${selectedGroup}.ics`; 
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
    
//     setTimeout(() => {
//         bar.style.display = 'none';
//         bar.style.width = '0%';
//     }, 1000);
// }


async function downloadCalendar() {
    const downloadButton = document.querySelector('button.step1');
    
    downloadButton.addEventListener('click', async () => {
        if (!selectedGroup) {
            alert('Najpierw wybierz grupę');
            return;
        }

        const bar = document.getElementById("bar");
        bar.style.display = 'block';
        bar.style.width = '0%';

        try {
            await animateProgressWithPromise(0, 50);
            const baseUrl = window.location.origin;
            
            const calendarUrl = `${baseUrl}/api/fetch-calendar/${selectedGroup}`;
            
            const response = await fetch(calendarUrl, { 
                method: 'HEAD',
                redirect: 'follow'
            });
            
            if (response.ok) {
                await animateProgressWithPromise(50, 100);
                window.location.href = calendarUrl;
            } else {
                throw new Error("Failed to fetch calendar");
            }
        } catch (error) {
            console.error(error);
            alert("Nie można wygenerować kalendarza. Spróbuj ponownie później.");
        } finally {
            bar.style.display = 'none';
            bar.style.width = '0%';
        }
    });
}

function displayQR() {
    const generatedButton = document.querySelector('button.step2');
    
    generatedButton.addEventListener('click', async () => {
        if (!selectedGroup) {
            alert('Najpierw wybierz grupę');
            return;
        }
        
        const bar = document.getElementById("bar");
        bar.style.display = 'block'; 
        bar.style.width = '0%';
        
        try {
            await animateProgressWithPromise(0, 50);
            
            const baseUrl = window.location.origin;
            const calendarUrl = `${baseUrl}/api/fetch-calendar/${selectedGroup}`;
            
            const response = await fetch(calendarUrl, { 
                method: 'HEAD',
                redirect: 'follow'
            });
            
            if (response.ok) {
                await animateProgressWithPromise(50, 100);
                
                document.querySelector('.QR-Code').style.display = 'block';
                document.getElementById("qrcode").innerHTML = '';
                new QRCode(document.getElementById("qrcode"), {
                    text: calendarUrl,
                    width: 128,
                    height: 128,
                });
            } else {
                throw new Error("Failed to fetch calendar");
            }
        } catch (error) {
            console.error(error);
            alert("Nie można wygenerować kodu QR. Spróbuj ponownie później.");
        } finally {
            bar.style.display = 'none';
            bar.style.width = '0%';
        }
    });
}

function animateProgressWithPromise(from, to) {
    return new Promise(resolve => {
        const elem = document.getElementById("bar");
        let width = parseInt(from);
        
        elem.style.display = 'block';
        elem.style.width = width + '%';
        
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
        }
        
        console.log(`Animating from ${from}% to ${to}%`);
        
        window.progressInterval = setInterval(() => {
            if (width >= to) {
                clearInterval(window.progressInterval);
                console.log(`Animation complete: ${to}%`);
                resolve(); 
            } else {
                width++;
                elem.style.width = width + '%';
            }
        }, 10);
    });
}

function resetProgress() {
    const bar = document.getElementById("bar");
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }
    bar.style.width = '0%';
    bar.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    fetchAndPopulateGroups();
    handleGroupSelection();
    downloadCalendar();
    displayQR();
});