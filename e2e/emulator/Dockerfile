# Firebase emulators (Firestore + Auth) for local end-to-end tests.
# No Google account, no network access to Firebase: project "demo-mess" is a
# demo project that only exists inside the emulator.
FROM node:22-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g firebase-tools@15.33.0 --ignore-scripts
WORKDIR /emu
COPY firebase.json .
RUN firebase setup:emulators:firestore --project demo-mess
EXPOSE 8085 9099
CMD ["firebase", "emulators:start", "--only", "firestore,auth", "--project", "demo-mess"]
