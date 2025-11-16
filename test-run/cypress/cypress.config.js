const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "https://example.com",
    specPattern: "specs/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: false,
    screenshotOnRunFailure: false,
    video: true,
  },
  reporter: "cypress-multi-reporters",
  reporterOptions: {
    reporterEnabled: "mochawesome",
    mochaJunitReporterReporterOptions: {
      mochaFile: "results/junit/test_results[hash].xml",
      toConsole: false,
    },
    mochawesomeReporterOptions: {
      reportDir: "results/mochawesome-report",
      quiet: true,
      overwrite: false,
      html: false,
      json: true,
    },
  },
});
