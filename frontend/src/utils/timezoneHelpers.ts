/**
 * Timezone utility functions for handling Croatia (UTC+2) and database timestamps (UTC+1 stored as UTC)
 */

/**
 * Converts a database timestamp to Croatian time (UTC+1 as stored in DB)
 * Database stores UTC+1 time but marks it as +00, so we need to interpret it correctly
 * 
 * @param timestamp - Database timestamp string (e.g., "2025-10-02 09:50:00+00")
 * @returns Object with formatted time and Date object
 */
export function convertDatabaseTimestamp(timestamp: string) {
  // Parse the timestamp as if it's already in UTC+1 (which it actually is, just marked wrong)
  const dbDate = new Date(timestamp);
  
  // Since the DB timestamp is actually UTC+1 but marked as UTC, 
  // we need to subtract 1 hour to get the correct UTC+1 time display
  const correctedDate = new Date(dbDate.getTime() - (1 * 60 * 60 * 1000));
  
  return {
    // Format for display as UTC+1 time
    displayTime: correctedDate.toLocaleString('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Zagreb' // This will show the time in Croatian timezone
    }),
    
    // Original timestamp for calculations
    originalDate: dbDate,
    
    // Corrected date for time ago calculations
    correctedDate: correctedDate,
    
    // Display with timezone info
    displayWithTimezone: `${correctedDate.toLocaleString('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })} (UTC+1)`
  };
}

/**
 * Alternative approach: Show the actual UTC+1 time as stored in database
 * This treats the database timestamp as the correct UTC+1 time
 */
export function showDatabaseTimeAsUTC1(timestamp: string) {
  // Parse the timestamp and treat it as the correct UTC+1 time
  const dbDate = new Date(timestamp);
  
  // Create a date that represents the same "wall clock" time but in UTC+1
  const utc1Time = new Date(dbDate);
  
  const correctedDate = new Date(dbDate.getTime() - (1 * 60 * 60 * 1000));

  return {
    // Show exactly what's in the database as UTC+1
    displayTime: utc1Time.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC'
    }).replace(',', ''),
    
    displayWithTimezone: `${utc1Time.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC'
    }).replace(',', '')} (UTC+1)`,
    
    // For time ago calculations, use the original database time
    dateForCalculations: correctedDate
  };
}

/**
 * Converts user-selected Croatian time to database search time
 * User selects Croatian local time (UTC+2) but wants to search for UTC+1 data
 * 
 * @param selectedDate - Date string in YYYY-MM-DD format
 * @param selectedTime - Time string in HH:MM format (Croatian local time)
 * @returns Date object adjusted for database search (UTC+1 time)
 */
export function convertCroatianTimeToDbSearchTime(selectedDate: string, selectedTime: string): Date {
  // Create the datetime string but subtract 1 hour to convert from Croatian (UTC+2) to database time (UTC+1)
  const [hours, minutes] = selectedTime.split(':').map(Number);
  const adjustedHours = hours; // Subtract 1 hour to get UTC+1 from UTC+2
  
  // Handle hour rollover (e.g., 00:xx becomes 23:xx of previous day)
  let adjustedDate = selectedDate;
  let finalHours = adjustedHours;
  
  if (adjustedHours < 0) {
    finalHours = 23;
    // Subtract one day
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    adjustedDate = date.toISOString().split('T')[0];
  }
  
  const adjustedTime = `${finalHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  // Create as UTC time (add Z) so it doesn't get converted again
  const dbSearchTime = new Date(`${adjustedDate}T${adjustedTime}:00.000Z`);
  
  return dbSearchTime;
}