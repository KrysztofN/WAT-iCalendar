https://github.com/user-attachments/assets/dbbde74b-5eb3-4979-ab2a-2675589f19fd

# iCalendar-WAT

This tool was built to help WAT students of WCY department import their timetables into their calendars!

### How does it work?
1. First visit website: [wat-icalendar](https://wat-icalendar.azurewebsites.net/)
2. Choose your group number
3. Download the plan or scan the QR code to get it!
4. The downloaded file in format 'groupID.ics' can be imported to any calendar.

---
### PC
You need to manually import the downloaded file into any calendar of your liking. 
<br/>
Example for **Outlook**:
- Click on calendar icon
- Select 'Add calendar' then 'Upload from file'
- Navigate to the previously downloaded file and import it.

---
### PHONE
Immediately after download,  **IOS** devices will open up the calendar where you can check the contents of the calendar to be added.
On **Android** devices manual import may be needed. 

---

### SHOWCASE
<p float="left">
    <img src = "https://github.com/KrysztofN/WAT-iCalendar/blob/main/public/assets/calendar.png" width="200" height="400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <img src = "https://github.com/KrysztofN/WAT-iCalendar/blob/main/public/assets/calendar_add.png" width="200" height="400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <img src = "https://github.com/KrysztofN/WAT-iCalendar/blob/main/public/assets/calendar_view.png" width="200" height="400">
</p>

---

### RUNNING LOCALLY
1. Make sure you have [Node.js](https://nodejs.org/en/download) and it is in your path.
2. Clone the repository:
```console
git clone https://github.com/KrysztofN/WAT-iCalendar.git
cd WAT-iCalendar
```
3. Install Docker and add it to your PATH.
4. Build and run the Docker container:
- If you have CMake installed
```console
make dockerize
``` 
- If you don't have CMake
```console
docker build -t icalendar-wat .
docker run -p 3000:3000 icalendar-wat
```
5. Access the app at http://localhost:8080 
