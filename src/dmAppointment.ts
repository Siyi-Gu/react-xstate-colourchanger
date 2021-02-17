import { MachineConfig, send, Action, assign } from "xstate";
import { stateValuesEqual } from "xstate/lib/State";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}

const grammar: { [index: string]: { person?: string, day?: string, time?: string,   } } = {
    "John": { person: "John Appleseed" },
    "Daniel": { person: "Daniel Skantz" },
    "Emma": { person: "Emma Stone" },
    "on Monday": { day: "Monday" },
    "on Tuesday": { day: "Tuesday" },
    "on Wednesday": { day: "Wednesday" },
    "on Thursday": { day: "Thursday" },
    "on Friday": { day: "Friday" },
    "at eight": { time: "8:00" },
    "at nine": { time: "9:00" },
    "at ten": { time: "10:00" },
    "at eleven": { time: "11:00" },
    "at twelve": { time: "12:00" },
    "at thirteen": { time: "13:00" },
    "at fourteen": { time: "14:00" },
    "at fifteen": { time: "15:00" },
    "at sixteen": { time: "16:00" },
    "at seventeen": { time: "17:00" },
    "at eightteen": { time: "18:00" },
}

const closedAnswer: { [index: string]: {yes?: boolean, no?: boolean}} = {
    "yes": { yes: true },
    "yep": { yes: true },
    "of course": { yes: true },
    "sure": { yes: true },
    "no": { no: false },
    "nope": { no: false },
    "not really": { no: false}
}

/* RASA API
 *  */
const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = 'https://lab2-for-ds.herokuapp.com/'
const nluRequest = (text: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        headers: { 'Origin': 'http://maraev.me' }, // only required with proxy
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());


export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({   
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: {
                RECOGNISED: {
                    target: 'rasa_invocation'
                }
            },
            states: {
                prompt: { 
                    entry: say("What do you would like to do?"),
                    on: { ENDSPEECH: "ask"} },
                ask:{
                    entry: listen()
                },
            }
        },
        rasa_invocation: {
            invoke: {
                id: 'rasa',
                src: (context, event) => nluRequest(context.recResult),
                onDone: {
                    target: 'intent_check',
                    actions: [
                        assign((context, event) => { return { intent: event.data.intent.name } }),
                    ],
                },
                onError: {
                    target: 'welcome',
                    actions: (context,event) => console.log(event.data),
                },
            }
        },
        intent_check: {
            on: { 
                ENDSPEECH: [{
                    cond: (context: { intent: string; }) => "todo" == context.intent,
                    target: 'todo',
                },
                {
                    cond: (context: { intent: string; }) => "appointment" == context.intent,
                    target: 'appointment',
                },
                {
                    cond: (context: { intent: string; }) => "timmer" == context.intent,
                    target: 'timer',
                }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK.`
                    })),
            },
            }
        },
        appointment: {
            initial: "prompt",
            on: { ENDSPEECH: "who" },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Let's create an appointment`
                    }))
                }}
        },
        who: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "person" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { person: grammar[context.recResult].person } }),
                    target: "day"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: say("Who are you meeting with?"),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry I don't know them"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        day: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "day" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { day: grammar[context.recResult].day } }),
                    target: "duration"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.person}. On which day is your meeting?`
                    })),
                    on: {ENDSPEECH: "ask"}
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry, I am not sure which day you mean"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        duration: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "yes" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].yes } }),
                    target: "confirm_whole",

                },
                {
                    cond: (context) => "no" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].no } }),
                    target: "time",
                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Will it take the whole day?`
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry, I didn't get it."),
                    on: { ENDSPEECH: "prompt" }
                },
                }
            },
        time: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "time" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { time: grammar[context.recResult].time } }),
                    target: "confirm_time"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. What time is your meeting?`
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry, I am not sure what time you mean"),
                    on: { ENDSPEECH: "prompt" }
                },
            }
        },
        confirm_time: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "yes" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].yes } }),
                    target: "created",

                },
                {
                    cond: (context) => "no" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].no } }),
                    target: "who",
                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry, I didn't get it"),
                    on: { ENDSPEECH: "prompt" }
                },
            }
        },
        confirm_whole: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "yes" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].yes } }),
                    target: "created",

                },
                {
                    cond: (context) => "no" in (closedAnswer[context.recResult] || {}),
                    actions: assign((context) => { return { confirm: closedAnswer[context.recResult].no } }),
                    target: "who",
                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry, I didn't get it"),
                    on: { ENDSPEECH: "prompt" }
                },
            }
        },
        created: {
            initial: "prompt",
            on: { ENDSPEECH: "final" },
            states: {
                prompt: {entry: say('Your appointment has been created.')}
            }
        },
        final: {
            type: 'final'
        },
        todo: {
            initial: 'prompt',
            states: {
                prompt: { entry: say("OK. What do you want me to add to the todo list?")}
            },
            on: { ENDSPEECH: "init" }
        },
        timer: {
            initial: 'prompt',
            states: {
                prompt: { entry: say("OK. I can set up a timer for you.")}
            },
            on: { ENDSPEECH: "init" }
        },
    }
})
