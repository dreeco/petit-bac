/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

'use strict';

const Alexa = require('alexa-sdk');
const Helpers = require('./func');
var fs = require('fs');

const http = require('http');
const https = require('https');

var categories = eval(fs.readFileSync('data/categories.js')+'');

var configuration = require('./skill-configuration.json');
var localization = require('./localization.json');


const HelloIntent = 'HelloIntent';
const LaunchRequest = 'LaunchRequest';
const SessionEndedRequest = 'SessionEndedRequest';
const Unhandled = 'Unhandled';
const GetNewLetterIntent = 'GetNewLetterIntent';
const GetNewCategoryIntent = 'GetNewCategoryIntent';
const ExampleIntent = 'ExampleIntent';
const StartAssistantIntent = 'StartAssistantIntent';
const ContinueQuizIntent = 'ContinueQuizIntent';
const ResetIntent = 'ResetIntent';

const letters = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z' ];

const handlers = {
    //Hello
    LaunchRequest: function () {
        this.emit(HelloIntent);
    },
    Unhandled: function(){
        this.emit(HelloIntent);
    },
    'AMAZON.FallBackIntent': function(){
        this.emit(HelloIntent);
    },
    SessionEndedRequest: function(){
        this.emit(HelloIntent);
    },
    HelloIntent: function(){
        var speak = '';
        if (!this.attributes || !this.attributes.lastSpeech)
            speak = localization.FIRST_HELP_MESSAGE + ' ';
        else if (this.attributes && this.attributes.quizz && this.attributes.quizz.used && this.attributes.quizz.used.length > 0)
            speak = localization.CONTINUE_QUIZ;
      
        this.attributes.lastSpeechType = HelloIntent;
        return quit(this, localization.HELLO + speak + localization.HELP_MESSAGE, localization.HELP_REPROMPT);
    },
    //Various
    'AMAZON.HelpIntent': function () {
        this.attributes.lastSpeechType = 'HelpIntent';
        quit(this, localization.HELP_MESSAGE, localization.HELP_MESSAGE);
    },
    'AMAZON.CancelIntent': function () {
        resetQuiz(this);
        quit(this, localization.STOP_MESSAGE);
    },
    'AMAZON.StopIntent': function () {
        var speak = '';

        if (this.attributes.quizz && this.attributes.quizz.used && this.attributes.quizz.used.length > 0) {
            
            var goodAnswers = Helpers.CalculateGoodAnswers(this);
        
            var lastIncentive = Helpers.GetIncentive(goodAnswers, this.attributes.quizz.used.length);
            
            var summary = localization.YOUVE_GOT_X_GOOD_ANSWER.replace('#goodAnswers', goodAnswers).replace('#questions', this.attributes.quizz.used.length);

            this.response.cardRenderer(localization.SKILL_NAME, `${lastIncentive.smiley} ${summary}. ${lastIncentive.smiley}`);
            
            speak = `${lastIncentive.say} ${summary} `; 
        }
        quit(this, speak + localization.STOP_MESSAGE);
    },
    'AMAZON.RepeatIntent': function () {
        if (this.attributes.lastSpeech)
            return quit(this, this.attributes.lastSpeech, this.attributes.lastListen);
        else
            return quit(this, `${localization.NOTHING_TO_REPEAT} ${localization.HELP_MESSAGE}`, localization.HELP_MESSAGE);
    },

    //Assistant
    GetNewLetterIntent: function () {
        loadCategories(this, GetNewLetter);
    },
    GetNewCategoryIntent: function () {
        loadCategories(this, GetNewCategory);
    },
    'AMAZON.MoreIntent': function(){
        if (this.attributes.lastSpeechType.indexOf(localization.GET_LETTER_MESSAGE) >= 0)
        {
            loadCategories(this, GetNewLetter);
        }
        else if (this.attributes.lastSpeechType.indexOf(localization.GET_CATEGORY_MESSAGE) >= 0)
        {
            loadCategories(this, GetNewCategory);
        }
        else
        {
           fail(this);
        }
    },
    ExampleIntent: function () {
        this.attributes.lastSpeechType = ExampleIntent;
        loadCategories(this, saySuggestion);
    },
    StartAssistantIntent: function(){
        this.attributes.lastSpeechType = StartAssistantIntent;
        this.attributes.usedCategories = undefined;
        this.attributes.usedLetters = undefined;
        this.attributes.lastSpeech = undefined;

        resetQuiz(this);
        
        var speak = localization.WELCOME_TO_ASSISTANT + ' ' + localization.SKILL_NAME;
        if (!this.attributes.assistantUsed)
        {
            speak += localization.ALEXA_CAN_SUGGEST_CATEGORIES_LETTERS_EXAMPLES + ' ';
            this.attributes.assistantUsed = true;
        }
        
        speak += localization.INTENT_EXAMPLES_ASSISTANT;
        return quit(this, speak, `${localization.DID_NOT_UNDERSTAND} ${localization.INTENT_EXAMPLES_ASSISTANT}`);
    },
    ResetIntent: function () {
        this.attributes.lastSpeechType = ResetIntent;
        this.emit(StartAssistantIntent);
    },
    'AMAZON.YesIntent': function () {
        if (this.attributes.lastSpeechType && this.attributes.lastSpeechType.indexOf(localization.GET_CATEGORY_MESSAGE) >= 0)
        {
            loadCategories(this, GetNewCategory);
        }
        else {
            quit(this, `${localization.DID_NOT_GET_YOUR_REQUEST}, ${localization.HELP_MESSAGE}`, localization.HELP_MESSAGE);
        }
    },
    'AMAZON.NoIntent': function () {
        if (this.attributes.lastSpeechType && this.attributes.lastSpeechType.indexOf(localization.GET_CATEGORY_MESSAGE) >= 0)
        {
            quit(this, `${localization.Okay}, ${localization.HELP_MESSAGE}`, localization.HELP_MESSAGE);
        }
        else if (this.attributes.quizz && this.attributes.quizz.lastCategory)
        {
            this.emit('IDontKnowIntent');
        }
        else {
            quit(this, `${localization.DID_NOT_GET_YOUR_REQUEST}, ${localization.HELP_MESSAGE}`, localization.HELP_MESSAGE);
        }
    },

    //QUIZ
    ContinueQuizIntent: function() {
        this.attributes.lastSpeechType = ContinueQuizIntent;
        loadCategories(this, function(self){
             if (!self.attributes.quizz | !self.attributes.quizz.used)
                getQuiz(self, false);
             
             return quit(self,  
                `${localization.GIVE_EXAMPLE_FOR_CATEGORY} : ${self.attributes.quizz.lastCategory}, ${localization.STARTING_BY_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}.`,
                `${localization.STILL_WAITING_FOR_ANSWER} : ${self.attributes.quizz.lastCategory} ${localization.AND_THE_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}. ${localization.HOW_TO_ANSWER_QUIZ_EXPLANATIONS}.`);
         });
        
    },
    'StartQuizzIntent': function(){
        this.attributes.lastSpeechType = 'StartQuizzIntent';
         var firstTime = '';
         if (!this.attributes.quizz)
         {
             firstTime = 
             `${localization.WELCOME_TO_THE_QUIZ} ${localization.SKILL_NAME}. ${localization.ALEXA_WILL_ASK_ANSWER_FOR_CATEGORY_AND_LETTER}.
             ${localization.EXAMPLE_FOR_QUIZ}.
             ${localization.QUIZ_ANSWER_DONTKNOW}. `;
         }
         
        resetQuiz(this);

        loadCategories(this, function(self){
             getQuiz(self, false);
             
             return quit(self,  
                `${firstTime}${localization.GIVE_EXAMPLE_FOR_CATEGORY} : ${self.attributes.quizz.lastCategory}, ${localization.STARTING_BY_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}.`,
                `${localization.STILL_WAITING_FOR_ANSWER} : ${self.attributes.quizz.lastCategory} ${localization.AND_THE_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}. ${localization.HOW_TO_ANSWER_QUIZ_EXPLANATIONS}".`);
         });
    },
    'IDontKnowIntent': function(){
        this.attributes.lastSpeechType = 'IDontKnowIntent';
        loadCategories(this, function(self){
    	    var result = GetSuggestion(self.attributes.quizz.lastLetter, self.attributes.quizz.lastCategory);
            return nextQuiz(self, result, false);
        })
    },
    'IGiveMyTongueToTheCatIntent': function(){
        this.attributes.lastSpeechType = 'IGiveMyTongueToTheCatIntent';
        loadCategories(this, function(self){
    	    var result = `${Helpers.Interjection(localization.MEOW)}. ${GetSuggestion(self.attributes.quizz.lastLetter, self.attributes.quizz.lastCategory)}`;
            return nextQuiz(self, result, false);
        })
    },
    'IsCorrectIntent': function () {
        this.attributes.lastSpeechType = 'IsCorrectIntent';
        if (!this.attributes.quizz || !this.attributes.quizz.lastCategory || !this.attributes.quizz.lastLetter)
            return quit(this, `${localization.NO_QUIZ_STARTED}`, localization.HELP_MESSAGE);

        var lastCategory = this.attributes.quizz.lastCategory;
        var lastLetter = this.attributes.quizz.lastLetter;
        var slots = Helpers.SafeExtract(this, ['event', 'request', 'intent', 'slots']);
        
        var w = Helpers.GetFirstValueFromSlot(slots);
        if (!w)
            return quit(this, localization.DID_NOT_UNDERSTAND, `${localization.STILL_WAITING_FOR_ANSWER} : ${self.attributes.quizz.lastCategory} ${localization.AND_THE_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}.`);

        w = w
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
            .toLowerCase();

        var firstLetter = w[0].toLowerCase();
        
        if (firstLetter.normalize('NFD').replace(/[\u0300-\u036f]/g, "") != lastLetter.toLowerCase())
            return nextQuiz(this, `${Helpers.Interjection(Helpers.GetFailInterjection())} ${w} ${localization.DOES_NOT_START_BY_LETTER} ${Helpers.Spell(lastLetter.toUpperCase())}.`, false);

        loadCategories(this, function(self){
            var category = '';
            
            for (var i = 0; i < categories.length; i++)
            {
                if (categories[i].name === lastCategory)
                {
                    if (categories[i][firstLetter] && categories[i][firstLetter].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(',').includes(w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ""))){
                        console.log('Answer from the sheet: ', w, self.attributes.quizz);
                        return nextQuiz(self, Helpers.GetSuccessInterjection(), true);
                    }
                    category = categories[i].wiki;
                }
            }
            
            if (category === ''){
                return quit(self, localization.ERROR_WIKIPEDIA);
            }
            
            Helpers.FetchWikiResults(w, category, (theResult) => {
                try {
                    
                    var jsonResult = JSON.parse(theResult);
                    console.log(jsonResult);
                    var success = Helpers.IsWordInWikiResult(w, jsonResult);
                    var speak = '';
                    if (success)
                        {
                            console.log('Answer from WIKI : ', w, self.attributes.quizz);
                            speak = Helpers.Interjection(Helpers.GetSuccessInterjection());
                            self.response.cardRenderer(localization.SKILL_NAME, `${localization.YOU_WIN} 😊`);
                        }
                    else
                        {
                            speak = `${Helpers.Interjection(Helpers.GetFailInterjection())} ${w} ${localization.DOES_NOT_BELONG_TO_CATEGORY} : ${lastCategory}. ${GetSuggestion(self.attributes.quizz.lastLetter, self.attributes.quizz.lastCategory)}.`;
                            self.response.cardRenderer(localization.SKILL_NAME, `${localization.YOU_LOST} 😢`);
                        }
                    
    
                    return nextQuiz(self, speak, success);
                }
                catch(e){
                    console.log('exception', e);
                    return quit(self, 'une erreur est survenue');
                };
            });
        });
    }
};

function nextQuiz(self, speak, success){
    if (getQuiz(self, success))
        return;
    
    return quit(self, 
        `${speak} ${localization.NOW_I_WANT_EXAMPLE_FOR_CATEGORY} : ${self.attributes.quizz.lastCategory}; ${localization.AND_THE_LETTER} ${Helpers.Spell(self.attributes.quizz.lastLetter)}.`,
        `${localization.STILL_WAITING_FOR_ANSWER} : ${self.attributes.quizz.lastCategory}; ${localization.AND_THE_LETTER} : ${Helpers.Spell(self.attributes.quizz.lastLetter)}`);
}

function loadCategories(self, callback){
    callback(self);
}

function saySuggestion(self){
    var slots = Helpers.SafeExtract(self, ['event', 'request', 'intent', 'slots']);
	var cat = Helpers.ExtractSlotsValue(slots, 'CategoryName');
	var letter = Helpers.ExtractSlotsValue(slots, 'ALetter');

	var hasCat = Helpers.HasSlotsValue(slots, 'CategoryName');
	var hasLetter = Helpers.HasSlotsValue(slots, 'ALetter');
	
	if (!letter){
	    if (hasLetter) 
            return quit(self, localization.I_DID_NOT_GET_WHICH_LETTER);
	    else if (self.attributes.usedLetters && self.attributes.usedLetters.length > 0)
	        letter = self.attributes.usedLetters[self.attributes.usedLetters.length - 1];
        else
            return quit(self, local.I_NEED_A_LETTER);
	}
	
    if (!cat)
    {
	    if (hasCat)
            return quit(self, localization.I_DID_NOT_GET_WHICH_CATEGORY);
        else if (self.attributes.usedCategories && self.attributes.usedCategories.length > 0)
	        cat = self.attributes.usedCategories[self.attributes.usedCategories.length - 1];
        else
            return quit(self, locallization.I_NEED_A_CATEGORY);
    }

    letter = letter.toLowerCase();
	var result = GetSuggestion(letter, cat);

    if (!result)
        quit(self, `${localization.I_DONT_KNOW_EWAMPLE_FOR_THIS_LETTER_AND_CATEGORY.replace('#letter', letter).replace('#category', cat)}`);
    else
        quit(self, result);
}

function GetSuggestion(letter, category){
	var result = localization.SORRY_NO_SUGGESTION.replace('#letter', Helpers.Spell(letter)).replace('#category', category);
	
	for (var i = 0; i < categories.length; i++){
		if (categories[i].name === category){
			if (categories[i][letter])
			{
				var suggestion = Helpers.GetRandomFromArray(categories[i][letter].split(','), []);
				
                if (suggestion === suggestion.toUpperCase())
                    suggestion = Helpers.Spell(suggestion);

				result = localization.FOR_LETTER_AND_CATEGORY.replace('#letter', Helpers.Spell(letter)).replace('#category', category).replace('#suggestion', suggestion);
			}
			break;
		}
	} 
	
	return result;
}

function GetNewLetter(self){
    if (!self.attributes.usedLetters)
            self.attributes.usedLetters = [];
            
    var randomFact = Helpers.GetRandomFromArray(letters, self.attributes.usedLetters);

    if (typeof(randomFact) === "undefined")
        noMoreLetters(self);
    else 
    {
        const speechOutput = localization.GET_LETTER_MESSAGE + Helpers.Spell(randomFact);
        const cardOutput = localization.GET_LETTER_MESSAGE + randomFact;
    
        self.response.cardRenderer(localization.SKILL_NAME, cardOutput);
    
        self.attributes.usedLetters.push(randomFact);
        
        self.attributes.lastSpeechType = localization.GET_LETTER_MESSAGE;
        self.attributes.lastSpeech = speechOutput;
        quit(self, speechOutput);
    }
}

function GetNewCategory(self){
    if (typeof(self.attributes.usedCategories) === 'undefined')
        self.attributes.usedCategories = [];
    
    var slots = Helpers.SafeExtract(self, ['event', 'request', 'intent', 'slots']);
	var nbCat = 1;
	
	if (slots)
	    nbCat = Helpers.ExtractSlotsValue(slots, 'Number');

    if (!nbCat)
        nbCat = 1;
    else if (nbCat > 10)
        nbCat = 10;
        
    var category = '';
    var card_category = '';
    for (var i = 0; i < nbCat; i++)
    {
        if (category)
        {
            category += ' ; <break time="3s"/>';
            card_category += ', ';
        }
        var cat = Helpers.GetRandomFromArray(categories, self.attributes.usedCategories).name;
        self.attributes.usedCategories.push(cat);
        category += cat;
        card_category += cat;
    }

    if (typeof(category) === "undefined")
        noMoreCategories(self);
    else 
    {
        var speechOutput = (nbCat > 1 ? localization.GET_CATEGORIES_MESSAGE : localization.GET_CATEGORY_MESSAGE) + ' ' + category;
        var cardOutput = (nbCat > 1 ? localization.GET_CATEGORIES_MESSAGE : localization.GET_CATEGORY_MESSAGE) + ' ' + card_category;

        self.response.cardRenderer(localization.SKILL_NAME, cardOutput);
    
        self.attributes.lastSpeechType = localization.GET_CATEGORY_MESSAGE;
        self.attributes.lastSpeech = speechOutput;
        quit(self, speechOutput + '. ' + localization.OTHER_CATEGORY, 'Dîtes : "oui" pour une nouvelle catégorie ; "non" pour écouter les possibilités offertes par petit bac.');
    }
    
}

function fail(self){
    quit(self, FAIL_REPROMPT, localization.HELP_MESSAGE);
}

function quit(self, speak, listen){
    self.attributes.lastSpeech = speak;
    self.attributes.lastListen = listen;
    
    console.log('Say: ', speak, self.attributes.quizz);
    
    self.response.speak(speak);
    
    if (listen)
        {
            console.log('Listen: ', listen);
            self.response.listen(listen);
        }

    if (configuration.IsProduction)
        self.emit(':saveState', true);
    else
        self.emit(':responseReady');

}

function noMoreCategories(self){
    quit(self, localization.NO_MORE_CATEGORIES_REPROMPT, localization.HELP_MESSAGE);
}

function noMoreLetters(self){
    quit(self, localization.NO_MORE_LETTERS_REPROMPT, localization.HELP_MESSAGE);
}

function getQuiz(self, success){
    var quizzCategories = [];
        
    //else 
    if (self.attributes.quizz.lastCategory && self.attributes.quizz.lastLetter)
    {
        if (!self.attributes.quizz.used){
            self.attributes.quizz.used = [];
        }
        
        self.attributes.quizz.used.push({
            letter: self.attributes.quizz.lastLetter, 
            category: self.attributes.quizz.lastCategory,
            success: success
        });
    }

    var availableLettersForCategory = [];

    for (var i = 0; i < categories.length; i++) 
    {
        if (categories[i].wiki)
        {
            var availableLetters = [];
            for (var n = 0; n < letters.length; n++){
                var letter = letters[n].toLowerCase();

                if (categories[i][letter] && !isLetterAndCategoryAlreadyUsed(self, categories[i].name, letter))
                    availableLetters.push(letter);
            }
            
            if (availableLetters && availableLetters.length > 0)
            {
                quizzCategories.push(categories[i].name);
                availableLettersForCategory[categories[i].name] = availableLetters;
            }
        }
    }
     
    var cat = Helpers.GetRandomFromArray(quizzCategories, []);
    if (!cat)
    {
        self.attributes.quizz.used = [];
        self.response.cardRenderer(localization.SKILL_NAME, `
            🎉🎉🎉 ${localization.CONGRATS} 🎉🎉🎉
            ${localization.END_OF_QUIZ.replace('#goodAnswers', self.attributes.quizz.used.length)}
        `);
        quit(self, `${localization.END_OF_QUIZ.replace('#goodAnswers', self.attributes.quizz.used.length)} ${localization.CONGRATS} !`);
        return true;
    }
    
    self.attributes.quizz.lastCategory = cat
    self.attributes.quizz.lastLetter = Helpers.GetRandomFromArray(availableLettersForCategory[cat], []);
    return false;
}

function resetQuiz(self) {
    self.attributes.quizz = {used : []};
}

function isLetterAndCategoryAlreadyUsed(self, category, letter){
    return self.attributes.quizz.used.find(
        function (o) {
            return o.letter === letter && o.category === category;
        });
}

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.appId = configuration.AppId;
    if (configuration.IsProduction)
        alexa.dynamoDBTableName = 'petitbac';
    var locale = event.request.locale;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
