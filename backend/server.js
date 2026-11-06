const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'config.env') });

const app = require('./app');
const dbConnection = require('./config/database');

const startServer = async () => {
  let database;
  try {
    database = await dbConnection();
  } catch (error) {
    console.error(`Database Error: ${error.message}`);
    process.exitCode = 1;
    return undefined;
  }

  const port = process.env.PORT || 8000;
  try {
    const server = await new Promise((resolve, reject) => {
      const listener = app.listen(port);
      listener.once('listening', () => resolve(listener));
      listener.once('error', reject);
    });
    console.log(`App running on port ${port}`);
    return server;
  } catch (error) {
    console.error(`Server Error: ${error.message}`);
    process.exitCode = 1;
    try {
      await database.disconnect();
    } catch (disconnectError) {
      console.error(`Database Error: ${disconnectError.message}`);
    }
    return undefined;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = startServer;
