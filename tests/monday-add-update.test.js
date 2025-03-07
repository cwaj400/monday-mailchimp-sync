// Mock the entire mondayClient module
jest.mock('../utils/mondayClient', () => {
  // Create a mock for executeQuery
  const mockExecuteQuery = jest.fn();
  
  // Return the mock structure
  return {
    mondayClient: {
      post: jest.fn()
    },
    executeQuery: mockExecuteQuery
  };
});

const {addNoteToMondayItem} = require('../utils/mondayService');
const { executeQuery } = require('../utils/mondayClient');

describe('add update', () => {
  // Set up environment variables
  beforeAll(() => {
    // Store original env variables
    this.originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.MONDAY_API_KEY = 'test-api-key';
    process.env.MONDAY_BOARD_ID = 'test-board-id';
  });
  
  // Restore original env variables
  afterAll(() => {
    process.env = this.originalEnv;
  });
  
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add a note successfully', async () => {
    // Mock executeQuery to handle both calls
    executeQuery
      .mockResolvedValueOnce({
        data: { 
          items: [{ id: '123' }] // For getMondayItem
        }
      })
      .mockResolvedValueOnce({
        data: { 
          create_update: { id: '456' } // For create_update
        }
      });
    
    const result = await addNoteToMondayItem('123', 'Test note');
    
    expect(result).toEqual({
      success: true,
      updateId: '456'
    });
    
    // Verify both calls happened
    expect(executeQuery).toHaveBeenCalledTimes(2);
  });

  it('should handle errors when adding an update', async () => {
    // Override the mock to simulate an error
    executeQuery.mockRejectedValueOnce(new Error('API Error'));

    // Call the function with test data
    const result = await addNoteToMondayItem('8628657282', 'test update');

    // Verify the error response
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Item not found');
  });
});