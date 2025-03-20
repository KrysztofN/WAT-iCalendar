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
            await animateProgressWithPromise(0, 30);
            const baseUrl = window.location.origin;
            let finalUrl;

            try {
                const primaryUrl = `${baseUrl}/api/fetch-calendar/${selectedGroup}`;
                const primaryResponse = await fetch(primaryUrl, { method: 'HEAD' });

                if (primaryResponse.ok) {
                    finalUrl = primaryUrl;
                } else {
                    throw new Error("Primary endpoint failed");
                }
            } catch (err) {
                try {
                    const fallbackUrl = `${baseUrl}/api/download-calendar/${selectedGroup}`;
                    const fallbackResponse = await fetch(fallbackUrl, { method: 'HEAD' });

                    if (fallbackResponse.ok) {
                        finalUrl = fallbackUrl;
                    } else {
                        throw new Error("Both endpoints failed");
                    }
                } catch (fallbackErr) {
                    console.error("All endpoints failed:", fallbackErr);
                    alert("Nie można wygenerować kalendarza. Spróbuj ponownie później.");
                    bar.style.display = 'none';
                    return;
                }
            }

            if (finalUrl) {
                await animateProgressWithPromise(30, 50);
                // await downloadWithProgress(finalUrl, bar, selectedGroup);
                await animateProgressWithPromise(50, 100);
                window.location.href = finalUrl;

            }
        } catch (error) {
            console.error(error);
            alert("Błąd pobierania pliku.");
        }
    });
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
        
        let shouldHideBar = false;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
            await animateProgressWithPromise(0, 30);
            bar.style.display = 'block';
            
            const baseUrl = window.location.origin;
            let finalUrl;
            
            try {
                const primaryUrl = `${baseUrl}/api/fetch-calendar/${selectedGroup}`;
                const primaryResponse = await fetch(primaryUrl, { method: 'HEAD' });
                
                if (primaryResponse.ok) {
                    finalUrl = primaryUrl;
                    
                    bar.style.display = 'block';
                    await animateProgressWithPromise(30, 70);
                } else {
                    shouldHideBar = true;
                    throw new Error("Primary endpoint failed");
                }
            } catch (err) {
                if (!shouldHideBar) {
                    bar.style.display = 'block';
                }
                
                try {
                    const fallbackUrl = `${baseUrl}/api/download-calendar/${selectedGroup}`;
                    const fallbackResponse = await fetch(fallbackUrl, { method: 'HEAD' });
                    
                    if (fallbackResponse.ok) {
                        finalUrl = fallbackUrl;
                        
                        bar.style.display = 'block';
                        await animateProgressWithPromise(30, 70);
                    } else {
                        shouldHideBar = true;
                        throw new Error("Both endpoints failed");
                    }
                } catch (fallbackErr) {
                    console.error("All endpoints failed:", fallbackErr);
                    alert("Nie można wygenerować kalendarza. Spróbuj ponownie później.");
                    shouldHideBar = true;
                    return;
                }
            }
            
            if (finalUrl) {
                bar.style.display = 'block';
                await animateProgressWithPromise(70, 100);
                
                document.querySelector('.QR-Code').style.display = 'block';
                document.getElementById("qrcode").innerHTML = '';
                new QRCode(document.getElementById("qrcode"), {
                    text: finalUrl,
                    width: 128,
                    height: 128,
                });
                
                setTimeout(() => {
                    bar.style.display = 'none';
                    bar.style.width = '0%';
                }, 500);
            }
        } finally {
            if (shouldHideBar) {
                bar.style.display = 'none';
                bar.style.width = '0%';
            }
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