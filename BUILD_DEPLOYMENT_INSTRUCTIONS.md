# BUILD

- To build the project with local sources, use:
```
dockker-compose -f docker-compose.yml -f build-compose-override.yml build
```

# DEPLOYMENT


 - Please set the following environment variables before running the project

`API_URL: (optional) To be set only if api is hosted somwhere else`

`TOKEN_ENDPOINT: Full token endpoint of Identity Management without query parameters (useDeflate or other...)`

`PUBLIC_KEY_URL: Full url to get the public key used to verify JWT token`

- To run the project, use:
```
docker-compose -f docker-compose.yml -f docker-compose-plugin.yml up
```
