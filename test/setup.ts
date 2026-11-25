// Browsers declared headless: false (a wallet needs a window a person can use) stay out of sight in tests.
process.env.HALO_TEST_HEADLESS = "1";
