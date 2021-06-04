IF [%1] == [] GOTO error


docker login
RMDIR /s /q .\dist\

call docker_build.bat

rem RUN DOCKER TO PUBLISH
docker tag web-broadcaster:latest registry.aptero.co/web-broadcaster:latest
docker push registry.aptero.co/web-broadcaster:latest

docker tag web-broadcaster:latest registry.aptero.co/web-broadcaster:%1
docker push registry.aptero.co/web-broadcaster:%1


GOTO :EOF
:error
ECHO incorrect_parameters