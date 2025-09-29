// Test setup file
import nock from 'nock';

// Ensure all HTTP requests are mocked during tests
beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});