dockerize:
	docker build -t icalendar-wat .
	docker run -p 3000:3000 -m 512m icalendar-wat