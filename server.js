const App = require('./src/app');

const app = new App();

app.initialize()
  .then(() => {
    app.start();
  })
  .catch((error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });