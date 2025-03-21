dockerize:
	docker build -t icalendar-wat .
	docker run -p 8080:8080 icalendar-wat