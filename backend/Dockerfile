# ---- build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
ARG GIT_COMMIT=unknown
RUN mvn -q package -DskipTests
# ---- run stage ----
FROM eclipse-temurin:17-jre
WORKDIR /app
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
COPY --from=build /build/target/steglab-backend.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-Djava.awt.headless=true","-jar","app.jar"]
