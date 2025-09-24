// Simple in-memory storage for the test variable
// In production, this would typically be stored in a database

let testVariable: string = 'Initial test value';

export const getTestVariable = (): string => {
  return testVariable;
};

export const updateTestVariable = (newValue: string): string => {
  testVariable = newValue;
  return testVariable;
};