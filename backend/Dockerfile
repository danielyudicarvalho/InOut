FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project manifests and restore dependencies first for Docker layer caching
COPY backend/Directory.Build.props backend/Directory.Packages.props backend/InOut.sln ./backend/
COPY backend/src/InOut.Domain/*.csproj backend/src/InOut.Domain/packages.lock.json ./backend/src/InOut.Domain/
COPY backend/src/InOut.Application/*.csproj backend/src/InOut.Application/packages.lock.json ./backend/src/InOut.Application/
COPY backend/src/InOut.Infrastructure/*.csproj backend/src/InOut.Infrastructure/packages.lock.json ./backend/src/InOut.Infrastructure/
COPY backend/src/InOut.Api/*.csproj backend/src/InOut.Api/packages.lock.json ./backend/src/InOut.Api/
RUN dotnet restore backend/src/InOut.Api/InOut.Api.csproj --locked-mode

# Copy source code and build release
COPY backend/src/ ./backend/src/
RUN dotnet publish backend/src/InOut.Api/InOut.Api.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
RUN apt-get update && apt-get install -y --no-install-recommends tini coreutils curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/inout \
    && chown -R $APP_UID:$APP_UID /var/log/inout
WORKDIR /app
COPY --from=build /app/publish .
COPY --chown=$APP_UID:$APP_UID db ./db
COPY --chmod=755 backend/docker-entrypoint.sh /app/docker-entrypoint.sh
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/app/docker-entrypoint.sh"]
