import type { IiziLanguage } from "./iiziDeterministicTypes.js";

export type LocalizedLineMap = Record<string, Record<IiziLanguage, string>>;

/** Backend-owned exact speech — Realtime must not translate. */
export const IIZI_LOCALIZED_LINES: LocalizedLineMap = {
  "greeting.initial": {
    et: "Tere!  Kahjuks kõik klienditeenindajad on hetkel hõivatud ning mina olen Iizi A-I kõnerobot Jaanika. Oskan aidata ainult autoabiga seoses. Kõne salvestatakse. Rääkige Teile sobivas keeles. Kuidas saame Teile abiks olla?",
    en: "Hello. All of our agents are busy at the moment. I am Maarika, the IIZI automated call assistant. This call is being recorded. You may speak Estonian, Russian, or English. Please briefly tell me what happened.",
    ru: "Здравствуйте. Все наши операторы сейчас заняты. Я Маарика, автоматический ассистент IIZI. Разговор записывается. Вы можете говорить на эстонском, русском или английском. Кратко скажите, что произошло.",
  },
  "intent.unclear_roadside_or_other": {
    et: "Kas pöördumine on seotud kohese autoabiga või muu IIZI kindlustusküsimusega?",
    en: "Is your request about immediate roadside assistance or another IIZI insurance matter?",
    ru: "Ваше обращение связано с немедленной помощью на дороге или с другим вопросом по страховке IIZI?",
  },
  "intent.confirm_flat_tire": {
    et: "Kas saan õigesti aru, et probleem on tühja rehviga?",
    en: "Do I understand correctly that the issue is a flat tire?",
    ru: "Правильно ли я понимаю, что проблема в спущенном колесе?",
  },
  "incident.accident": {
    et: "Sain aru, et toimus avarii.",
    en: "I understand there was an accident.",
    ru: "Поняла, произошла авария.",
  },
  "incident.no_start": {
    et: "Sain aru, et auto ei käivitu.",
    en: "I understand the car will not start.",
    ru: "Поняла, машина не заводится.",
  },
  "incident.flat_tire": {
    et: "Sain aru, et rehv on purunenud.",
    en: "I understand you have a flat tire.",
    ru: "Поняла, у вас спустило колесо.",
  },
  "incident.out_of_fuel": {
    et: "Sain aru, et kütus on otsas.",
    en: "I understand you are out of fuel.",
    ru: "Поняла, закончилось топливо.",
  },
  "incident.locked_out": {
    et: "Sain aru, et võtmed jäid autosse.",
    en: "I understand your keys are locked in the car.",
    ru: "Поняла, ключи остались в машине.",
  },
  "incident.stuck": {
    et: "Sain aru, et auto on kinni.",
    en: "I understand the car is stuck.",
    ru: "Поняла, машина застряла.",
  },
  "incident.tow_needed": {
    et: "Sain aru, et vajate pukseerimist.",
    en: "I understand you need towing.",
    ru: "Поняла, вам нужна эвакуация.",
  },
  "incident.mechanical_issue": {
    et: "Sain aru, et autol on tehniline rike.",
    en: "I understand there is a mechanical problem with the car.",
    ru: "Поняла, у машины техническая неисправность.",
  },
  "incident.generic_roadside": {
    et: "Sain aru, et vajate autoabi.",
    en: "I understand you need roadside assistance.",
    ru: "Поняла, вам нужна помощь на дороге.",
  },
  "crm.known": {
    et: "Leidsin selle telefoninumbri järgi Teie kliendikonto.",
    en: "I found your customer account for this phone number.",
    ru: "Я нашла ваш клиентский аккаунт по этому номеру телефона.",
  },
  "crm.unknown": {
    et: "Selle telefoninumbri järgi ma kliendikontot ei leidnud.",
    en: "I did not find a customer account for this phone number.",
    ru: "По этому номеру телефона я не нашла клиентский аккаунт.",
  },
  "sms.combined.sent_success": {
    et: "Saatsin Teile SMS-i. Avage link, sisestage auto registreerimismärk, kinnitage asukoht ja vajutage Kinnita.",
    en: "I sent you a text message. Please open the link, enter your registration number, confirm your location, and press Confirm.",
    ru: "Я отправила вам SMS. Откройте ссылку, введите регистрационный номер, подтвердите местоположение и нажмите Подтвердить.",
  },
  "sms.combined.already_sent": {
    et: "SMS on juba saadetud. Palun kontrollige, kas see jõudis Teieni.",
    en: "The SMS has already been sent. Please check whether you received it.",
    ru: "SMS уже отправлено. Пожалуйста, проверьте, получили ли вы его.",
  },
  "sms.combined.send_failed": {
    et: "SMS-i saatmist ei saanud kinnitada.",
    en: "I could not confirm that the SMS was sent.",
    ru: "Не удалось подтвердить отправку SMS.",
  },
  "form.registration.received": {
    et: "Sain registreerimisnumbri kätte.",
    en: "I received the registration number.",
    ru: "Я получила регистрационный номер.",
  },
  "form.not_received_yet": {
    et: "Mul ei ole registreerimisnumbrit veel kätte tulnud.",
    en: "I have not received the registration number yet.",
    ru: "Я еще не получила регистрационный номер.",
  },
  "form.waiting_sms_help": {
    et: "Mul ei ole Teie andmeid veel kätte tulnud. Saatsin Teile SMS-i. Palun avage sõnumite rakendus, vajutage lingile, kerige alla, sisestage auto registreerimismärk, kinnitage asukoht ja vajutage Kinnita.",
    en: "I do not have your details yet. I sent you an SMS. Please tap the link, scroll down, enter your registration number, confirm your location, and press Confirm.",
    ru: "У меня пока нет ваших данных. Я отправила вам SMS. Пожалуйста, откройте ссылку, прокрутите вниз, введите регистрационный номер, подтвердите местоположение и нажмите Подтвердить.",
  },
  "vehicle_location.combined.readback": {
    et: "Sain Teie andmed kätte.",
    en: "I received your details.",
    ru: "Я получила ваши данные.",
  },
  "vehicle.match_false.handoff": {
    et: "Sain registreerimisnumbri kätte, aga ma ei leidnud selle numbriga sõidukit meie andmetest. Edastan info meie töötajale, kes võtab Teiega ühendust viie kuni kümne minuti jooksul.",
    en: "I received the registration number, but I could not find a vehicle with that number in our records. I will pass this to our agent, who will contact you within five to ten minutes.",
    ru: "Я получила регистрационный номер, но не нашла автомобиль с этим номером в наших данных. Передам информацию нашему сотруднику, который свяжется с вами в течение пяти–десяти минут.",
  },
  "vehicle.insurance_inactive.handoff": {
    et: "Sain sõiduki andmed kätte, kuid kindlustuse staatus ei ole aktiivne. Edastan info meie töötajale, kes võtab Teiega ühendust viie kuni kümne minuti jooksul.",
    en: "I received the vehicle details, but the insurance status is not active. I will pass this to our agent, who will contact you within five to ten minutes.",
    ru: "Я получила данные автомобиля, но страховка не активна. Передам информацию нашему сотруднику, который свяжется с вами в течение пяти–десяти минут.",
  },
  "vehicle.match_active.readback": {
    et: "Sain sõiduki ja aktiivse kindlustuse kinnituse kätte.",
    en: "I received confirmation of the vehicle and active insurance coverage.",
    ru: "Я получила подтверждение автомобиля и активного страхового покрытия.",
  },
  "location.received.readback": {
    et: "Sain asukoha kätte: {address}.",
    en: "I received the location: {address}.",
    ru: "Я получила местоположение: {address}.",
  },
  "location.not_received_yet": {
    et: "Mul ei ole asukohta veel kätte tulnud.",
    en: "I have not received the location yet.",
    ru: "Я еще не получила местоположение.",
  },
  "occupants.ask": {
    et: "Mitu inimest on autos koos juhiga?",
    en: "How many people are in the car including the driver?",
    ru: "Сколько человек в машине вместе с водителем?",
  },
  "occupants.confirm_two": {
    et: "Kas saan õigesti aru, et autos on kaks inimest koos juhiga?",
    en: "Do I understand correctly that there are two people in the car including the driver?",
    ru: "Правильно ли я понимаю, что в машине двое человек вместе с водителем?",
  },
  "occupants.received": {
    et: "Selge, panin kirja.",
    en: "Understood, I have noted that.",
    ru: "Понятно, записала.",
  },
  "callback.ask_same_number": {
    et: "Kas tagasihelistamise number on sama? Palun vasta täislausega.",
    en: "Should we use the same number you are calling from for the callback?",
    ru: "Для обратного звонка использовать тот же номер, с которого вы звоните?",
  },
  "callback.ask_same_number_clarify": {
    et: "Ma ei saanud aru. Kas tagasihelistamise number on sama? Palun vastake: number on sama või soovin teist numbrit.",
    en: "I did not understand. Is the callback number the same as the number you are calling from? Please answer: same number or I want a different number.",
    ru: "Я не поняла. Использовать для обратного звонка тот же номер? Ответьте: тот же номер или другой номер.",
  },
  "callback.same_number_confirmed": {
    et: "Okei, helistame tagasi samale numbrile.",
    en: "Okay, we will call you back on the same number.",
    ru: "Хорошо, мы перезвоним на этот же номер.",
  },
  "callback.different_number_sms_sent": {
    et: "Saatsin Teile uue SMS-i, kuhu saate sisestada oma tagasihelistamise numbri. Palun avage sõnum, sisestage oma tagasihelistamise number ja vajutage Kinnita.",
    en: "I sent you an SMS to enter your callback number. Please open the link and enter the number you want us to call back.",
    ru: "Я отправила вам SMS для ввода номера обратного звонка. Пожалуйста, откройте ссылку и введите номер, на который вы хотите получить звонок.",
  },
  "callback.sms_failed": {
    et: "Tagasihelistamise numbri SMS-i saatmist ei saanud kinnitada.",
    en: "I could not confirm sending the callback number SMS.",
    ru: "Не удалось подтвердить отправку SMS для номера обратного звонка.",
  },
  "callback.form_received": {
    et: "Sain Teie tagasihelistamise numbri kätte.",
    en: "I received your callback number.",
    ru: "Я получила ваш номер для обратного звонка.",
  },
  "handoff.normal_partner": {
    et: "Aitäh. Vajalik info on nüüd koos. Teie juhtum edastatakse meie partnerile ja Teiega võetakse ühendust viie kuni kümne minuti jooksul.",
    en: "Thank you. We have the necessary information. Your case will be passed to our partner and you will be contacted within five to ten minutes.",
    ru: "Спасибо. Вся необходимая информация собрана. Ваш случай будет передан партнеру, с вами свяжутся в течение пяти–десяти минут.",
  },
  "handoff.tow_partner": {
    et: "Aitäh. Vajalik info on nüüd koos. Teie asukohta saadetakse puksiir ja Teiega võetakse ühendust viie kuni kümne minuti jooksul.",
    en: "Thank you. We have the necessary information. A tow truck will be sent to your location and you will be contacted within five to ten minutes.",
    ru: "Спасибо. Вся необходимая информация собрана. К вашему местоположению отправят эвакуатор, с вами свяжутся в течение пяти–десяти минут.",
  },
  "handoff.human_followup": {
    et: "Aitäh. Teie juhtum on registreeritud ja edastan info meie töötajale. Teiega võetakse ühendust viie kuni kümne minuti jooksul.",
    en: "Thank you. Your case has been registered and I will pass the information to our agent. You will be contacted within five to ten minutes.",
    ru: "Спасибо. Ваш случай зарегистрирован, я передам информацию нашему сотруднику. С вами свяжутся в течение пяти–десяти минут.",
  },
  "closing.anything_else": {
    et: "Kas saan veel millegagi aidata?",
    en: "Can I help you with anything else?",
    ru: "Могу ли я еще чем-то помочь?",
  },
  "closing.goodbye": {
    et: "Aitäh. Lõpetan kõne. Head aega.",
    en: "Thank you. I will end the call now. Goodbye.",
    ru: "Спасибо. Завершаю звонок. До свидания.",
  },
  "closing.ask_additional_info": {
    et: "Kas Te soovite midagi lisada omalt poolt enne kui kõne lõpetame?",
    en: "Would you like to add anything before we end the call?",
    ru: "Хотите ли вы что-то добавить, прежде чем мы завершим звонок?",
  },
  "closing.additional_info_declined": {
    et: "Okei, aitäh. Helistame peatselt tagasi.",
    en: "Okay, thank you. We will call you back shortly.",
    ru: "Хорошо, спасибо. Мы скоро перезвоним.",
  },
  "closing.ask_what_to_add": {
    et: "Mida soovite lisada?",
    en: "What would you like to add?",
    ru: "Что вы хотите добавить?",
  },
  "closing.additional_info_acknowledged": {
    et: "Aitäh. Meie klienditeenindaja võtab selle arvesse ja võtab Teiega ühendust peatselt. Nägemist.",
    en: "Thank you. Our agent will take this into account and contact you shortly. Goodbye.",
    ru: "Спасибо. Наш сотрудник учтёт это и свяжется с вами в ближайшее время. До свидания.",
  },
};
