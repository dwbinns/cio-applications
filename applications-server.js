'use strict';

var staticServer = require('./staticServer');
var url = require('url');
var http = require('http');
var nodemailer = require('nodemailer');
var fs = require('mz/fs');
var path = require('path');
const puppeteer = require('puppeteer');
const { google } = require('googleapis');

const Airtable = require('airtable');


require('./static/polyfill');

var config;
try {
    config = require('./config');
} catch (e) {
    console.log('Unable to load config.js');
    process.exit(1);
}


var baseUrl = config.baseUrl;

if (baseUrl[baseUrl.length - 1] != '/') baseUrl = baseUrl + '/';




var port = 8078;
var columns = [
    "id", "url", "team1", "team2", "team3", "team3x", "different-teams", "other-teams", "nomail",
    "full-name", "known-by", "age", "nationality",
    "sex", "married", "partnerteam", "partnername", "university", "friend", "friendname", "address",
    "email", "mobile", "previous", "previousdates", "ifes", "hear", "church",
    "christian", "change", "why", "gospel", "answerAccept", "answerBible", "answerReligions", "evangelism", "crossCultural",
    "caterer", "drama", "music", "nurse", "assistant", "caterer-emergency", "treasurer", "bike", "sports", "english", "tech",
    "gifts", "instrument", "what-instrument", "bicycle", "car", "accommodation", "accommodation-address", "confident-cyclist", "can-ride",
    "english-native", "english-toefl-550", "english-ielts-6", "english-other", "english-level", "languages", "allergies",
    "fees", "title", "full-name", "known-by", "sex", "date-of-birth",
    "offence", "convictions", "risk", "risks", "sanctions", "disciplinary",
    "ref1-name", "ref1-title", "ref1-email", "ref1-phone", "ref1-address", "ref1-christian",
    "ref2-name", "ref2-title", "ref2-email", "ref2-phone", "ref2-address",
    "fulltime", "statement-of-faith",
    "started", "finished",
    "social", "general-information", "data-protection",
    "photo-consent", "ref1-known", "insurance", "news",
    "ref1-whynot", "emergency-name", "emergency-phone", "emergency-email", "emergency-relationship", "photo",
    "ref2-christian"
];


function log(request) {
    console.log.apply(console, [new Date(), request].concat(Array.from(arguments).slice(1)));
}

class AirtableWriter {
    constructor({ apiKey, base, table, attachments }) {
        this.base = new Airtable({ apiKey }).base(base);
        this.table = table;
        this.attachments = attachments;
    }

    async write(form) {
        return (await this.base(this.table).create([{
            "fields": {
                "ID": form.id,
                "Full name": form['full-name'],
                "Age": form['age'],
                "Country": form['nationality'],
                "Email": form['email'],
                "Address": form['address'],
                "Phone": form['mobile'],
                "Team1": form['team1'],
                "Team2": form['team2'],
                "Team3": form['team3'],
                "Ref1 name": form["ref1-name"],
                "Ref1 email": form["ref1-email"],
                "Ref1 title": form["ref1-title"],
                "Bikeability": form["can-ride"],
                "English ability": form["english-native"] ? 'native' : form['english-toefl-550'] ? 'TOEFL 550' : form['english-ielts-6'] ? 'IELTS 6' : form['english-level'],
                "Own accommodation": form["accommodation"],
                "Address Cambridge": form["accommodation-address"],
                "Languages": form['languages'],
                "Team Caterer": form['caterer'],
                "Drama Coordinator": form['drama'],
                "Music Coordinator": form['music'],
                "Team nurse": form['nurse'],
                "Caterer’s assistant": form['assistant'],
                "Team treasurer": form['treasurer'],
                "Bicycle repairer": form['bike'],
                "Leading sports activities": form['sports'],
                "Teaching English": form['english'],
                "Computer/Tech helper": form['tech'],
                "Social Media Co-ordinator": form['social'],
                "Emergency Name": form['emergency-name'],
                "Emergency Phone": form['emergency-phone'],
                "Emergency Email": form['emergency-email'],
                "Emergency Relationship": form['emergency-relationship'],
                "Support": form['allergies'],
                "Sex": form['sex'],
                ...(this.attachments ? {
                    "Photo": [
                        {
                            "url": form['photo']
                        }
                    ],

                    "Application": [
                        {
                            "url": new URL(`./data/${form.id}/form.pdf`, baseUrl).toString()
                        }
                    ],
                    "Safeguarding": [
                        {
                            "url": new URL(`./data/${form.id}/safeguarding.pdf`, baseUrl).toString()
                        }
                    ],
                } : {}),
                "Form": form.url
            }
        },
        ])).map(record => record.getId()).join(",");
    }
}

class GoogleSpreadSheet {

    constructor({ sheet, spreadsheetId, keyFile }) {
        this.sheet = sheet;
        this.spreadsheetId = spreadsheetId;
        this.latestRequest = Promise.resolve();

        let auth = new google.auth.GoogleAuth({
            keyFile,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: "v4", auth });

    }

    save(request, id, form) {
        log(request, 'Save requested');

        let saved = this.latestRequest.then(async () => {
            const data = columns.map((name) => (name in form ? form[name] : "-"));

            let { data: { values: ids } } = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheet}!A2:A`,
                valueRenderOption: 'UNFORMATTED_VALUE',
            });

            let row = ids ? ids.map(([id]) => id).indexOf(id) : undefined;
            let range;

            if (row >= 0) {
                let result = await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheet}!A${row + 2}`,
                    valueInputOption: 'RAW',
                    resource: { values: [data] }
                });

                log(request, 'Spreadsheet updated', result.data);

                range = result.data.updatedRange;
            } else {
                let result = await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheet}!A2`,
                    valueInputOption: 'RAW',
                    resource: { values: [data] }
                });

                log(request, 'Spreadsheet appended', result.data);

                range = result.data.updates.updatedRange;
            }


            return range;
        });
        this.latestRequest = saved.catch(err => null);
        return saved;
    }
}

class Emailer {

    constructor(sendTo) {
        this.sendTo = sendTo;

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.emailAccount,
                pass: config.emailPassword,
            }
        });
    }

    send(errors, pdfFilename, form, dataStatus, pdfStatus, pdfSafeguardingStatus, pdfGeneralStatus, spreadsheetStatus, airtableStatus) {

        var text = [
            'CIO Application'
        ];

        text.push('Saved form : ' + dataStatus);
        text.push('Saved PDF : ' + pdfStatus);
        text.push('Saved PDF (safeguarding): ' + pdfSafeguardingStatus);
        text.push('Saved PDF (general): ' + pdfGeneralStatus);
        text.push('Saved Spreadsheet : ' + spreadsheetStatus);
        text.push('Saved to airtable : ' + airtableStatus);
        text.push();

        text.push(form.email);

        let adminEmail = this.transporter.sendMail({
            from: config.emailAccount,
            to: this.sendTo,
            subject: 'CIO Application ' + (errors ? 'ERRORS' : 'OK'),
            text: text.join('\r\n')
        });

        let submitterEmail = this.transporter.sendMail({
            from: config.emailAccount,
            to: form.email,
            subject: 'CIO Application',
            attachments: {
                path: pdfFilename
            },
            text: 'Thank you for completing the application. You should hear from one of the team soon.'
        });
        return Promise.all([adminEmail, submitterEmail]);
    }

}


function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

function promiseTimeout(timeout) {
    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
}

class PDFCreator {

    constructor(copyPath, mode) {
        this.copyPath = copyPath;
        this.mode = mode;
    }

    async create(request, filename, id, form) {

        log(request, 'Starting puppeteer');

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        log(request, 'Opening form');

        let url = "http://localhost:" + port + "?print" + this.mode + "#load=" + id;
        await page.goto(url, {
            waitUntil: 'networkidle2',
        });

        log(request, 'Rendering PDF', filename);

        await page.pdf({ path: filename, format: 'a4' });

        await browser.close();

        if (this.copyPath) {
            let target = path.join(this.copyPath, sanitize(form.id + '_' + form['full-name'].replace(' ', '_') + this.mode) + '.pdf');
            log(request, 'Copying pdf to ' + target);
            let pdfContent = await fs.readFile(filename);
            await fs.writeFile(target, pdfContent);
        }

        log(request, 'Done PDF');
    }

}




async function save(request, urlbase, id, form) {

    function processError(err) {
        console.log(err || err.stack);
        errors = true;
        return 'Failed:' + err;
    }

    var prefix = path.join('data', id);

    log(request, 'saving:' + JSON.stringify(form));

    await mkdir(prefix);

    let pdfFile = path.join(prefix, 'form.pdf');
    let safeguardingPdfFile = path.join(prefix, 'safeguarding.pdf');
    let generalPdfFile = path.join(prefix, 'general.pdf');

    let errors = false;

    let url = urlbase + '#load=' + id;

    form.url = url;

    let dataStatus = await fs.writeFile(path.join(prefix, 'form.json'), JSON.stringify(form)).then(() => 'OK');

    let [pdfStatus, pdfSafeguardingStatus, pdfGeneralStatus, googleSpreadsheetStatus] = await Promise.all([
        pdfCreator ? pdfCreator.create(request, pdfFile, id, form).then(renderedFile => 'OK', processError) : 'Disabled',
        pdfCreatorSafeguarding ? pdfCreatorSafeguarding.create(request, safeguardingPdfFile, id, form).then(renderedFile => 'OK', processError) : 'Disabled',
        pdfCreatorGeneral ? pdfCreatorGeneral.create(request, generalPdfFile, id, form).then(renderedFile => 'OK', processError) : 'Disabled',
        googleSpreadsheet ? googleSpreadsheet.save(request, id, form).then(row => 'OK - row:' + row, processError) : 'Disabled',
    ]);

    log(request, 'Writing to airtable', airtableWriter ? "enabled" : "disabled");
    let airtableStatus = airtableWriter ? await airtableWriter.write(form).then((ids) => `Saved to airtable ${ids}`, processError) : "Disabled";

    log(request, 'Emails sending...');
    let emailStatus = await emailer.send(errors, pdfFile, form, dataStatus, pdfStatus, pdfSafeguardingStatus, pdfGeneralStatus, googleSpreadsheetStatus, airtableStatus);


    log(request, 'Complete')
    await fs.writeFile(path.join(prefix, 'log.json'), JSON.stringify({ id, dataStatus, pdfStatus, pdfSafeguardingStatus, googleSpreadsheetStatus, emailStatus, airtableStatus }));
}

function readAll(stream) {
    return new Promise((resolve, reject) => {
        var content = [];
        stream.on('data', data => content.push(data));
        stream.on('end', () => resolve(Buffer.concat(content)));
    });
}

async function mkdir(dir) {
    try {
        await fs.mkdir(dir);
    } catch (err) {
        if (err.code == 'EEXIST') return;
        throw err;
    }
}

let requestSequence = 0;

var server = http.createServer(async function (req, res) {

    function respond(err) {
        res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify({ 'status': err || 'OK' }));
        res.end();
    }

    try {

        let request = requestSequence++;
        log(request, req.url);



        var parsedURL = url.parse(req.url);
        var components = parsedURL.pathname.split('/');
        if (components[1] == 'data') {
            staticServer.serve('data', req, res, 'data');
        } else if (components[1] == 'server') {
            if (components[2] == 'image') {
                let data = await readAll(req);
                var id = components[3];
                var prefix = path.join('data', id);
                await mkdir(prefix)
                await fs.writeFile(path.join(prefix, 'image.' + components[4]), data);
                respond();
            }
            if (components[2] == 'save') {
                let data = await readAll(req);
                await save(request, baseUrl, components[3], JSON.parse(data));
                respond();
            }
        } else {
            staticServer.serve('static', req, res);
        }
    } catch (e) {
        respond(e);
        console.log(e.stack);
    }

});

let airtableWriter = config.airtable && new AirtableWriter(config.airtable);
var googleSpreadsheet = config.spreadsheet && new GoogleSpreadSheet(config.spreadsheet);
var emailer = config.email && new Emailer(config.email);
var pdfCreator = new PDFCreator(config.pdf, '');
var pdfCreatorSafeguarding = new PDFCreator(config.pdfSafeguarding, '-safeguarding');
var pdfCreatorGeneral = new PDFCreator(config.pdfGeneral, '-general');

async function initialise() {

    try {
        await mkdir('data');
        server.listen(port);
        console.log('listening :' + port);
    } catch (e) {
        console.log('Unable to start up');
    }
}

initialise();
