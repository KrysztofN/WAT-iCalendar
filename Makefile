dockerize:
	docker build -t icalendar-wat .
	docker run -p 3000:3000 icalendar-wat