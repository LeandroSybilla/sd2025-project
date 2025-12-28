# Use the Node.js image to build the app
FROM node:22

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the listening port
EXPOSE 8000

# Run the application
CMD [ "node", "index.js" ]