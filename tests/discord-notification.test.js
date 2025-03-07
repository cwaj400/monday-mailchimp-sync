const {sendDiscordNotification} = require('../utils/discordNotifier');

describe('send discord notification', () => {
    it('should send a discord notification', async () => {
        const result = await sendDiscordNotification(
            'TEST FOR DISCORD NOTIFICATIONS',
            'This is a test for discord notifications',
            {
              'Error': 'Test error',
              'Event Type': 'Test event type',
              'Stack Trace': 'Test stack trace'
            },
            '2b28da' // Purple color for TESTS
          );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
    })
})