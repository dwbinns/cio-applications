exports.baseUrl = 'https://host/path/';
exports.spreadsheet = {
    spreadsheetId: 'id-of-google-spreadsheet',
    keyFile: './get-a-key-file-from-google.json',
    sheet: 'Worksheet name here',
};
exports.email = 'send-applications-to-this-address@email.example.com';

exports.airtable = {
    apiKey: 'airtable-api-key',
    base: 'identifier-of-airtable-base',
    table: 'airtable-table-name',
    attachments: true, // set this to false if applications server isn't reachable on the internet
};
exports.emailAccount = 'email-account-that-will-send-emails@gmail.com'; // sends via gmail
exports.emailPassword = 'gmail-app-password';