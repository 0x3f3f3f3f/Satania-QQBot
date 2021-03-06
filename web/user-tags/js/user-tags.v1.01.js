function addCard(parent, userTag) {
    let type;
    switch (userTag.type) {
        case 'regexp':
            type = '正则';
            break;
        case 'string':
            type = '简单';
            break;
        default:
            type = '未知'
            break;
    }

    const card = $(
        '<div class="card">' +
        '<div class="card-header p-2">' +
        `<div class="row${currentID!=userTag.id?' collapsed':''}" id="heading${userTag.id}" data-toggle="collapse" data-target="#collapse${userTag.id}" aria-expanded="${currentID!=userTag.id?'false':'true'}" aria-controls="collapse${userTag.id}">` +
        '<div class="col-6 text-truncate">' +
        `#${userTag.id} ` +
        (userTag.enabled ? (userTag.type == 'string' ?
                `<span class="badge badge-primary mr-1">${type}</span>` :
                `<span class="badge badge-info mr-1">${type}</span>`) :
            '<span class="badge badge-secondary mr-1">失效</span>') +
        (userTag.editable ? '<span class="badge badge-success mr-1">可编辑</span>' : '') +
        (userTag.type == 'string' ? userTag.match.split(',').join(' ') : userTag.match) +
        '</div>' +
        `<div class="col text-truncate font-italic" style="color: lightgray;">${userTag.comment!=''?'//'+userTag.comment:''}</div>` +
        (userTag.group == 'admin' ?
            `<div class="col-1"><span class="badge badge-dark float-right mt-1">${userTag.userName}</span></div>` :
            `<div class="col-1"><span class="badge badge-secondary float-right mt-1">${userTag.userName}</span></div>`
        ) +
        '</div>' +
        '</div>' +
        `<div id="collapse${userTag.id}" class="collapse${currentID==userTag.id?' show':''}" aria-labelledby="heading${userTag.id}" data-parent="#${parent.attr('id')}">` +
        '<div class="card-body"></div>' +
        '</div>' +
        '</div>'
    );

    const body = $(
        '<div class="row mb-4">' +
        '<div class="col">' +
        '<p class="mb-1">拦截规则</p>' +
        '<div class="row mx-0" id="matchButtons"></div>' +
        `<input type="text" class="form-control" id="matchInput" value="${userTag.match}">` +
        '</div>' +
        '<div class="col-4 text-right">' +
        '<p class="mb-1">规则类型</p>' +
        '<button class="btn btn-info dropdown-toggle" type="button" id="matchTypeButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"' +
        ` match-type="${userTag.type}">${type}</button>` +
        '<div class="dropdown-menu dropdown-menu-right" aria-labelledby="matchTypeButton">' +
        '<button class="dropdown-item" type="button" id="string">简单</button>' +
        '<button class="dropdown-item" type="button" id="regexp">正则</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="row mb-4">' +
        '<div class="col">' +
        '<p class="mb-1">对应Pixiv站日文标签</p>' +
        '<div class="row mx-0" id="rawTagButtons"></div>' +
        '</div>' +
        '</div>' +
        '<div class="row mb-4">' +
        '<div class="col">' +
        '<p class="mb-1">注释</p>' +
        '<div class="input-group">' +
        '<div class="input-group-prepend">' +
        '<span class="input-group-text">//</span>' +
        '</div>' +
        `<input type="text" class="form-control" id='commentInput' value="${userTag.comment}">` +
        '</div>' +
        '</div>' +
        '</div>'
    );

    const matchButtons = body.find('#matchButtons');
    const matchInput = body.find('#matchInput');
    matchInput.blur(() => {
        matchInput.val(matchInput.val().replace(/,/g, ''));
    });
    if (userTag.type == 'string') {
        matchInput.hide();
        if (userTag.match != '') {
            const keywords = userTag.match.split(',');
            if (userTag.editable) {
                for (let i = 0; i < keywords.length; i++) {
                    const keyword = keywords[i];
                    const btn = addMatchButton(keyword);
                    matchButtons.append(btn);
                }
            } else {
                for (let i = 0; i < keywords.length; i++) {
                    const keyword = keywords[i];
                    matchButtons.append(
                        `<label class="alert alert-info px-2 py-1 mr-1 mb-1">${keyword}</label>`
                    );
                }
            }
        }
    } else {
        matchButtons.hide();
    }

    const rawTagButtons = body.find('#rawTagButtons');
    if (userTag.rawTags != '') {
        const rawTags = userTag.rawTags.split(',');
        if (userTag.editable) {
            for (let i = 0; i < rawTags.length; i++) {
                const tag = rawTags[i];
                const btn = addRawTagButton(tag);
                rawTagButtons.append(btn);
            }
        } else {
            for (let i = 0; i < rawTags.length; i++) {
                const tag = rawTags[i];
                switch (tag) {
                    case '|':
                        rawTagButtons.append(
                            '<label class="alert alert-light px-1 py-1 mr-1 mb-1">或</label>'
                        );
                        break;
                    case '&':
                        rawTagButtons.append(
                            '<label class="alert alert-light px-1 py-1 mr-1 mb-1">与</label>'
                        );
                        break;
                    default:
                        rawTagButtons.append(
                            `<label class="alert alert-info px-2 py-1 mr-1 mb-1">${tag}</label>`
                        );
                        break;
                }
            }
        }
    }

    card.find('.card-body').append(body);

    if (userTag.editable) {
        const btn1 = $('<button type="button" class="btn btn-outline-info mb-1">新增...</button>');
        btn1.click(addMatch);
        matchButtons.append(btn1);
        const btn2 = $('<button type="button" class="btn btn-outline-info mb-1">新增...</button>');
        btn2.click(addRawTag);
        rawTagButtons.append(btn2);
        const div = $('<div class="row">' +
            '<div class="col-6">' +
            '<div class="custom-control custom-switch">' +
            `<input type="checkbox" class="custom-control-input" id="userTagEnabled${userTag.id}"${userTag.enabled?' checked':''}>` +
            `<label class="custom-control-label" for="userTagEnabled${userTag.id}">启用这条规则</label>` +
            '</div>' +
            '</div>' +
            '<div class="col-6 text-right">' +
            '<button type="button" class="btn btn-primary w-75" id="submit">请稍后...</button>' +
            '</div>' +
            '</div>');
        const btn3 = div.find('#submit');
        btn3.click({
            id: userTag.id,
            card
        }, submitUserTag);
        btn3.attr('disabled', true);
        setTimeout(() => {
            btn3.text('提交');
            btn3.attr('disabled', false);
        }, 3000);
        body.parent().append(div);

        const matchTypeButton = body.find('#matchTypeButton');
        const dropdownMenu = body.find('.dropdown-menu[aria-labelledby="matchTypeButton"]');
        dropdownMenu.find('#string').click({
            type: 'string',
            matchTypeButton,
            matchButtons,
            matchInput
        }, changeTagType);
        dropdownMenu.find('#regexp').click({
            type: 'regexp',
            matchTypeButton,
            matchButtons,
            matchInput
        }, changeTagType);
    } else {
        matchInput.attr('disabled', true);
        body.find('#matchTypeButton').attr('disabled', true);
        body.find('#commentInput').attr('disabled', true);
    }

    parent.append(card);
    return card;
}

function updateUserTagsList(userTags) {
    const userTagList = $('#userTagList');
    userTagList.empty();
    for (let i = 0; i < userTags.length; i++) {
        const userTag = userTags[i];
        if (i < userTags.length - 1) {
            addCard(userTagList, userTag);
        } else {
            if (userTag.editable) {
                const card = addCard(userTagList, userTag);
                const cardHeading = card.find('#heading-1');
                cardHeading.empty();
                cardHeading.append(
                    '<div class="col text-truncate text-right">' +
                    '<button type="button" class="btn btn-primary btn-sm" id="newUserTag">新增...</button>' +
                    '</div>'
                );
            }
        }
    }
}

function addMatchButton(keyword) {
    const btn = $(
        `<button type="button" class="btn btn-info mr-1 mb-1">${keyword}</button>`
    );
    btn.click(editMatch);
    return btn;
}

function addRawTagButton(tag) {
    let btn;
    switch (tag) {
        case '|':
            btn = $(
                '<button type="button" class="btn btn-light px-2 mr-1 mb-1" operator="|">或</button>'
            );
            btn.click(changeTagOperator);
            break;
        case '&':
            btn = $(
                '<button type="button" class="btn btn-light px-2 mr-1 mb-1" operator="&">与</button>'
            );
            btn.click(changeTagOperator);
            break;
        default:
            btn = $(
                `<button type="button" class="btn btn-info mr-1 mb-1">${tag}</button>`
            );
            btn.click(editRawTag);
            break;
    }
    return btn;
}

function changeTagType(event) {
    event.data.matchTypeButton.attr('match-type', event.data.type);
    switch (event.data.type) {
        case 'string':
            event.data.matchTypeButton.text('简单');
            event.data.matchButtons.show();
            event.data.matchInput.hide();
            break;
        case 'regexp':
            event.data.matchTypeButton.text('正则');
            event.data.matchButtons.hide()
            event.data.matchInput.show();
            break;
    }
}

function addMatch() {
    const btn = $(this);
    btn.hide();
    const input = $(`<input type="text" class="form-control">`);
    const div = $('<div class="col-6 pl-0 pr-1"></div>');
    div.append(input);
    div.insertBefore(btn);
    input.focus();
    input.bind('blur keypress', event => {
        if (event.type == 'blur' || event.keyCode == 13) {
            input.val(input.val().replace(/,/g, ''));
            if (/^\s*$/.test(input.val())) {
                div.remove();
                btn.show();
            } else {
                const btnNew = addMatchButton(input.val());
                btnNew.insertBefore(btn);
                div.remove();
                btn.show();
            }
        }
    });
}

function editMatch() {
    const btn = $(this);
    const keyword = btn.text();
    btn.hide();
    const input = $(`<input type="text" class="form-control" value="${keyword}">`);
    const div = $('<div class="col-6 pl-0 pr-1"></div>');
    div.append(input);
    div.insertBefore(btn);
    input.focus();
    input.bind('blur keypress', event => {
        if (event.type == 'blur' || event.keyCode == 13) {
            input.val(input.val().replace(/,/g, ''));
            if (/^\s*$/.test(input.val())) {
                div.remove();
                btn.remove();
            } else {
                btn.text(input.val());
                div.remove();
                btn.show();
            }
        }
    });
}

function addRawTag() {
    const btn = $(this);
    btn.hide();
    const input = $(`<input type="text" class="form-control">`);
    const div = $('<div class="col-4 pl-0 pr-1"></div>');
    div.append(input);
    div.insertBefore(btn);
    input.focus();
    input.bind('blur keypress', event => {
        if (event.type == 'blur' || event.keyCode == 13) {
            input.val(input.val().replace(/,/g, ''));
            if (/^\s*$/.test(input.val())) {
                div.remove();
                btn.show();
            } else {
                if (btn.parent().children().length > 2) {
                    const operatorNew = addRawTagButton('|');
                    operatorNew.insertBefore(btn);
                }
                const btnNew = addRawTagButton(input.val());
                btnNew.insertBefore(btn);
                div.remove();
                btn.show();
            }
        }
    });
}

function editRawTag() {
    const btn = $(this);
    const tag = btn.text();
    btn.hide();
    const input = $(`<input type="text" class="form-control" value="${tag}">`);
    const div = $('<div class="col-4 pl-0 pr-1"></div>');
    div.append(input);
    div.insertBefore(btn);
    input.focus();
    input.bind('blur keypress', event => {
        if (event.type == 'blur' || event.keyCode == 13) {
            input.val(input.val().replace(/,/g, ''));
            if (/^\s*$/.test(input.val())) {
                div.remove();
                if (btn.prev().length > 0) {
                    btn.prev().remove();
                }
                btn.remove();
            } else {
                btn.text(input.val());
                div.remove();
                btn.show();
            }
        }
    });
}

function changeTagOperator() {
    const btn = $(this);
    switch (btn.attr('operator')) {
        case '|':
            btn.attr('operator', '&');
            btn.text('与');
            break;
        case '&':
            btn.attr('operator', '|');
            btn.text('或');
            break;
    }
}

async function submitUserTag(event) {
    const btn = $(this);
    btn.attr('disabled', true);
    btn.html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
        '请稍后...'
    );

    const id = event.data.id;
    const card = event.data.card;

    const enabled = card.find(`#userTagEnabled${id}`).is(':checked');

    let match = '';
    const type = card.find('#matchTypeButton').attr('match-type');
    switch (type) {
        case 'string':
            const matchButtons = card.find('#matchButtons').children();
            for (let i = 0; i < matchButtons.length - 1; i++) {
                const matchBtn = $(matchButtons[i]);
                match += (match == '' ? '' : ',') + matchBtn.text();
            }
            break;
        case 'regexp':
            match = card.find('#matchInput').val();
            break;
    }

    let rawTags = '';
    const rawTagButtons = card.find('#rawTagButtons').children();
    for (let i = 0; i < rawTagButtons.length - 1; i++) {
        const rawTagBtn = $(rawTagButtons[i]);
        let tag = '';
        if (rawTagBtn.attr('operator')) {
            tag = rawTagBtn.attr('operator');
        } else {
            tag = rawTagBtn.text();
        }
        rawTags += (rawTags == '' ? '' : ',') + tag;
    }

    const userTag = {
        enabled,
        type,
        match,
        rawTags,
        comment: card.find('#commentInput').val()
    }

    let response;
    if (id == -1) {
        response = await SataniaAPI.setUserTag(searchParams.get('key'), userTag);
    } else {
        response = await SataniaAPI.setUserTag(searchParams.get('key'), {
            id,
            ...userTag
        });
    }

    let btnClass;
    if (response.result) {
        btnClass = 'btn-success';
        btn.toggleClass(btnClass);
        btn.text('提交成功');
        currentID = id;
        await new Promise(resolve => setTimeout(resolve, 2000));
        response = await SataniaAPI.getUserTags(searchParams.get('key'));
        updateUserTagsList(response.userTags);
        return;
    } else {
        btnClass = 'btn-danger';
        btn.toggleClass(btnClass);
        btn.text('提交失败');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    btn.toggleClass(btnClass);
    btn.attr('disabled', false);
    btn.text('提交');
}

function init() {
    const userTagList = $('#userTagList');
    const btnTop = $(
        '<div class="row">' +
        '<div class="col text-center">' +
        '<button class="btn btn-link text-decoration-none" id="go-page-bottom">去底部</button>' +
        '</div>' +
        '</div>'
    );
    btnTop.find('#go-page-bottom').click(() => {
        $('html, body').animate({
            scrollTop: $(document).height()
        }, 'slow');
    });
    const btnBottom = $(
        '<div class="row">' +
        '<div class="col text-center">' +
        '<button class="btn btn-link text-decoration-none" id="go-page-top">去顶部</button>' +
        '</div>' +
        '</div>'
    );
    btnBottom.find('#go-page-top').click(() => {
        $('html, body').animate({
            scrollTop: 0
        }, 'slow');
    });
    if (!searchParams.get('key')) {
        const chatqq = $(
            '<div class="text-center small">' +
            '<div class="text-secondary">想自己编辑？' +
            '<button class="text-decoration-none p-0" id="btn" style="border:none;outline:none;background-color:transparent;color:#ff68af">对我说：编辑标签</button>' +
            '</div>' +
            '</div>'
        );
        chatqq.find('#btn').click(() => {
            window.open('chatqq.html');
        });
        chatqq.insertBefore(userTagList);
    }
    btnTop.insertBefore(userTagList);
    btnBottom.insertAfter(userTagList);
}