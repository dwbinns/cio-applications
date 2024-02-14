
var id;

var form = {};

var inputSelector = 'input,select,textarea';

function log(message) {
    var logElement = document.querySelector('#console');
    logElement.textContent = logElement.textContent + '\n' + message;
    console.log(message);
}

function find(s) {
    return document.querySelector(s);
}

function findAll(s) {
    return Array.from(document.querySelectorAll(s));
}

function xpath(expression, context) {
    var result = document.evaluate(expression, context || document.documentElement, null, XPathResult.ANY_TYPE, null);
    switch (result.resultType) {
        case XPathResult.NUMBER_TYPE: return result.numberValue;
        case XPathResult.STRING_TYPE: return result.stringValue;
        case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
        case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            var found = [];
            var res;
            while (res = result.iterateNext()) found.push(res);
            return found;
    }

}


function adjacent(reference, selector, position) {
    return findAll(selector).filter(function (e) {
        return e != reference && (reference.compareDocumentPosition(e) & position);
    });
}

function before(reference, selector) {
    return adjacent(reference, selector, Node.DOCUMENT_POSITION_PRECEDING).pop();
}

function after(reference, selector) {
    return adjacent(reference, selector, Node.DOCUMENT_POSITION_FOLLOWING).shift();
}


function Submitter() {
    var xhr = new XMLHttpRequest();


    var busy;



    function send(count) {

        document.querySelector('#finished').value = formatDate();

        getFormValues();

        xhr.onload = saved;
        xhr.onerror = failed;
        xhr.open('POST', "./server/save/" + id, true);
        xhr.send(JSON.stringify(form));
        busy = true;
        function saved() {

            busy = false;
            if (xhr.status === 200) {
                alert('Sent');
                reset();
                find('#save').style.visibility = null;
                find('#saving').style.display = 'none';
            } else {
                failed();
            }
        }
        function failed() {
            if (count == 0) {
                alert('Failed');
                find('#save').style.visibility = null;
                find('#saving').style.display = 'none';
            } else {
                send(count - 1);
            }
        }
    }

    this.send = send;
}




function showThumbnail() {
    find('#photo .thumbnail').style.backgroundImage = `url("${find('#photo input[type="text"]').value + '?' + Math.random()}")`;
}






function handleFile(file) {

    if (!file || !file.type.match(/image.*/)) {
        return;
    }

    var imagetype = file.type.split('/')[1];

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "./server/image/" + id + "/" + imagetype);


    xhr.send(file);
    find('#photo .loading').style.display = 'block';
    find('#photo .thumbnail').style.display = 'none';
    xhr.onload = function () {
        var input = find('#photo input[type="text"]');
        find('#photo .loading').style.display = 'none';
        find('#photo .thumbnail').style.display = 'block';
        input.value = new URL(`./data/${id}/image.${imagetype}`, location);
        showThumbnail();
        updateElement(input);
    }
}





function getElement(input) {
    if (input.type == 'file') return;

    form[input.name] = (input.type == 'checkbox') ? input.checked : input.value;
}


function toggle(element, clazz, add) {
    if (add) element.classList.add(clazz);
    else element.classList.remove(clazz);
}

function checkElement(input) {

    if (input.value == '!<test>!') {
        findAll('textarea,input[type="text"]').forEach(t => {
            if (t.name != 'photo' && t.name != 'email') t.value = t.labels[0].childNodes[0].textContent.replaceAll(/\s+/g, ' ');
        });
        findAll('select').forEach(function (t) { t.value = t.querySelectorAll('option')[1].value; });
        findAll('input[type="checkbox"]').forEach(function (t) { t.checked = true; });
        checkAll();
        return;
    }

    if (!input.matches(inputSelector)) return;
    if (input.type == 'file') return;

    resizeTextarea(input);

    getElement(input);

    var label = input.closest('label');

    /*if (!label) {
        label=before(input,'label');
    }*/

    if (!label) return;

    var next = after(label, 'label');

    if (next && next.getAttribute("data-if")) {
        var ifValue = next.getAttribute("data-if");
        var valueFound = !input.disabled && (input.type == 'checkbox' ? input.checked : input.value == ifValue);
        toggle(next, 'disabled', !valueFound);
        Array.from(next.querySelectorAll(inputSelector)).forEach(function (i) { i.disabled = !valueFound; checkElement(i) });
    }

    var valid = input.value != '';

    var group = input.closest('.any');
    if (group) {
        valid = Array.from(group.querySelectorAll('input')).some(function (i) { return i.checked; });

    }

    if (label.classList.contains('optional') || label.classList.contains('disabled')) {
        label.setAttribute('valid', '');
    } else {

        label.setAttribute('valid', valid ? 'yes' : 'no');

        if (group) {
            group.setAttribute('valid', valid ? 'yes' : 'no');
            Array.from(group.querySelectorAll('label')).forEach(function (i) { i.setAttribute('valid', valid ? 'yes' : 'no'); });
        }
    }
}

function wordLimiter(input, wordLimit) {
    var index = 0;
    var wordCount = 0;
    while (index < input.length) {
        var match = input.slice(index).match(/[^ \r\n\t]+/);
        if (!match) index = input.length;
        else {
            index += match.index;
            if (wordCount >= wordLimit) break;
            index += match[0].length;
            wordCount++;
        }
    }
    return { wordCount: wordCount, text: input.slice(0, index) };
}


function TextareaManager(textarea) {
    var label = textarea.closest('label');
    var popup = document.createElement('span');
    popup.className = 'popup';

    var recommended = textarea.getAttribute('recommended');
    var recommendedText = recommended ? 'recommended: ' + recommended + ', ' : '';

    function update() {
        var wordResult = wordLimiter(textarea.value, 200);
        toggle(popup, 'toolong', wordResult.wordCount > 100);
        textarea.value = wordResult.text;
        popup.textContent = 'Wordcount: ' + wordResult.wordCount + ', ' + recommendedText + 'maximum: 200';
    }

    update();



    label.appendChild(popup);
    textarea.addEventListener('focus', function () {
        popup.style.display = 'inline';
        update();
    });
    textarea.addEventListener('blur', function () { popup.style.display = 'none'; });
    textarea.addEventListener('input', update);
}




function updateElement(input) {

    checkElement(input);
    findAll('*[name="' + input.name + '"]').forEach(function (i) {
        if (i != input) {
            i.value = input.value;
            checkElement(i);
        }
    });
    saveForm();
}

function getFormValues() {


    findAll(inputSelector).map(function (input) {
        getElement(input);
    });

    saveForm();

}

function loadFormValues() {

    log('Loading:' + id);

    var xhr = new XMLHttpRequest();
    xhr.onload = loaded;
    xhr.open('GET', "./data/" + id + "/form.json", true);
    xhr.send();

    function loaded() {
        log('Loaded:' + xhr.status);
        if (xhr.status === 200) {
            setFormValues(JSON.parse(xhr.response));
        } else {
            alert('Failed to load form data');
        }

    }
}

function immediateTextcontent(element) {
    var children = element.childNodes;
    var text = '';
    for (var i = 0; i < children.length; i++) {
        if (children[i].nodeType == Node.TEXT_NODE) text += children[i].nodeValue;
    }
    return text;
}

function saveForm() {
    form.id = id;
    window.localStorage.setItem('formValues', JSON.stringify(form));
    var invalidList = findAll('label[valid="no"]:not(.disabled)');



    var valid = invalidList.length == 0;


    toggle(document.body, 'notvalid', !valid);
    toggle(document.body, 'valid', valid);

    var remaining = find('.remaining');
    remaining.innerHTML = '';

    invalidList.forEach(function (label) {
        var note = document.createElement('div');
        note.textContent = immediateTextcontent(label);
        note.addEventListener('click', function () {
            label.classList.add('highlight'); setTimeout(function () { label.classList.remove('highlight'); }, 1000);
            label.scrollIntoView();
            label.focus();
        });
        remaining.appendChild(note);
    });

}

function checkAll() {
    findAll(inputSelector).map(function (input) {
        checkElement(input);
    });
    showThumbnail();
    saveForm();
}

function resizeTextarea(textarea) {
    if (textarea.matches('textarea')) {
        while (textarea.scrollHeight > textarea.clientHeight) textarea.setAttribute('rows', +textarea.getAttribute('rows') + 1);
    }
}

function setFormValues(data) {
    id = data.id;
    findAll(inputSelector).map(function (input) {
        if (input.type == 'file') return;

        var name = input.name;
        if (input.type == 'checkbox') input.checked = data[name];
        else input.value = data[name] || '';
        resizeTextarea(input);
    });
    showThumbnail();
    checkAll();
}

function randomId() {
    return new Date().getTime() + '' + Math.round(Math.random() * 100000);
}

function formatDate() {
    return new Date().toISOString().replace(/[TZ]/g, ' ');
}

function reset() {
    findAll(inputSelector).map(function (input) {
        if (input.type == 'file') return;

        if (input.type == 'checkbox') input.checked = false;
        else input.value = '';
    });
    id = randomId();

    document.querySelector('#started').value = formatDate();

    checkAll();

}

function initialise() {

    log('initialising: search:' + location.search + ' hash:' + location.hash);

    if (location.hash.startsWith('#load=')) {

        id = location.hash.slice('#load='.length);
        location.hash = '#';
        loadFormValues();

    } else {

        var storage = window.localStorage;


        var formValues = storage.getItem('formValues');
        if (formValues) {
            try {
                setFormValues(JSON.parse(formValues));
            } catch (e) {
                console.log(e.stack);
            }
        } else {
            reset();
        }
    }



    if (location.search == '?print-safeguarding') {
        document.body.classList.add('safeguarding');
        return;
    }
    if (location.search == '?print-general') {
        document.body.classList.add('general');
        return;
    }
    if (location.search == '?print') return;

    document.body.classList.add('interactive_on');




    window.addEventListener('input', function (e) {
        updateElement(e.target);
    });

    window.addEventListener('change', function (e) {
        updateElement(e.target);
    });

    var textareas = document.querySelectorAll('textarea');
    for (var i = 0; i < textareas.length; i++) new TextareaManager(textareas[i]);

    var photoFile = find('#photo-file');

    find('#photo-label').addEventListener('click', function (e) {
        find('#file-label').click();
        e.preventDefault();
    });

    photoFile.addEventListener("change", function () { handleFile(this.files[0]); });



    var submitter = new Submitter();

    find('#save').onclick = function () {
        find('#save').style.visibility = 'hidden';
        find('#saving').style.display = 'block';
        submitter.send(5);
    };

    find('#reset').onclick = reset;

}



window.onload = function () {
    try {
        log('startup');
        Array.from([]);
        initialise();
    } catch (e) {
        alert('Browser not supported. Do not use this form');
        log(e.stack || e);
    }
}
