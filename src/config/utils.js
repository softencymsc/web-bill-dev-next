/* eslint-disable @typescript-eslint/no-unused-vars */
function padZero(num) {
  return num < 10 ? `0${num}` : num.toString();
}
export function formatDateTimestamp(inputDateTime) {
  if (inputDateTime) {
    const dateTime = inputDateTime.toDate();

    const year = dateTime.getFullYear() % 100;
    const month = dateTime.getMonth() + 1;
    const day = dateTime.getDate();

    const formattedDate = `${padZero(day)}/${padZero(month)}/${padZero(year)}`;

    return `${formattedDate}`;
  } else {
    return "NA";
  }
}
export function formatDateTime(inputDateTime) {
  if (inputDateTime) {
    // Parse the input date-time string
    const dateTime = new Date(inputDateTime);

    const year = dateTime.getFullYear() % 100; // Get the last two digits of the year
    const month = dateTime.getMonth() + 1; // Months are 0-based, so add 1
    const day = dateTime.getDate();
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const seconds = dateTime.getSeconds();

    // Create the formatted date and time string
    const formattedDate = `${padZero(day)}/${padZero(month)}/${padZero(year)}`;
    console.log(`${formattedDate}`);

    return `${day ? formattedDate : "NA"}`;
  }
}
export function formatNewDate(dateTime) {
  if (dateTime) {
    const year = dateTime.getFullYear() % 100; // Get the last two digits of the year
    const month = dateTime.getMonth() + 1; // Months are 0-based, so add 1
    const day = dateTime.getDate();
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const seconds = dateTime.getSeconds();

    // Create the formatted date and time string
    const formattedDate = `${padZero(day)}/${padZero(month)}/${padZero(year)}`;
    console.log(`${formattedDate}`);

    return `${day ? formattedDate : "NA"}`;
  }
}
export function roundOff(input) {
  if (typeof input === "number") {
    return input.toFixed(2);
  } else if (typeof input === "string") {
    let parsedNumber = parseFloat(input);
    if (!isNaN(parsedNumber)) {
      return parseFloat(parsedNumber.toFixed(2));
    } else {
      console.error("Invalid input: Not a valid number string");
      return NaN;
    }
  } else {
    console.error("Invalid input: Not a number or a string");
    return NaN;
  }
}
