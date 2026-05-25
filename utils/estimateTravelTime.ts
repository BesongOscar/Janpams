export const estimateTravelTime = (timeString: string) => {
  const multipliers = {
    driving: 1,
    walking: 4.5,
    bicycling: 2,
  };

  // Converts "1 hr, 25 mins, 35 secs" into total minutes
  const convertToMinutes = (timeString: string) => {
    let totalMinutes = 0;

    const hoursMatch = timeString.match(/(\d+)\s*hr?s?/);
    const minutesMatch = timeString.match(/(\d+)\s*min?s?/);

    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);

    return totalMinutes;
  };

  // Converts total minutes into "X hr(s) Y min(s) Z sec(s)" format
  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    let parts = [];
    if (hours) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
    if (minutes) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);

    return parts.join(' ');
  };

  const drivingMinutes = convertToMinutes(timeString);

  return {
    driving: formatTime(drivingMinutes),
    walking: formatTime(drivingMinutes * multipliers.walking),
    bicycling: formatTime(drivingMinutes * multipliers.bicycling),
  };
};
