.PHONY: up down logs test k8s-deploy k8s-delete
up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose build post-service media-service publisher-service
	docker compose run --rm --no-deps -v "$(CURDIR)/services/post-service/tests:/app/tests:ro" post-service pytest -q
	docker compose run --rm --no-deps -v "$(CURDIR)/services/media-service/tests:/app/tests:ro" media-service pytest -q
	docker compose run --rm --no-deps -v "$(CURDIR)/services/publisher-service/tests:/app/tests:ro" publisher-service pytest -q
	docker run --rm -v "$(CURDIR)/frontend:/app" -w /app node:20-alpine sh -c 'npm install --no-audit --no-fund && npm run test'

k8s-deploy:
	kubectl apply -k k8s/

k8s-delete:
	kubectl delete -k k8s/ --ignore-not-found
