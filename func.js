const https = require('https');
const localization = require('./localization.js');

module.exports = {
    GetRandomFromArray: function (factArr, used) {
        var copy = factArr.slice();
         for(var i =0; i< used.length; i++ ) {
             for(var j= 0; j< copy.length;j++) {
              if (used[i] === copy[j]) {
               copy.splice(j,1);
               break;
             }
           }
         }
      
        const factIndex = Math.floor(Math.random() * copy.length);
        const randomFact = copy[factIndex];
    
        return randomFact;
    },
    CalculateGoodAnswers: function(self) {
        var goodAnswers = 0;
            for (var i = 0; i < self.attributes.quizz.used.length; i++){
                if (self.attributes.quizz.used[i].success){
                    goodAnswers++;
                }
            }
        return goodAnswers;
    },
    GetIncentive: function(goodAnswers, totalQuestion){
        var incentive = [
                {say : localization.OUCH, percent : 10, smiley: '😢'},
                {say : localization.OH_NO, percent : 20, smiley: '😞'},
                {say : localization.DANG, percent : 30, smiley: '😕'},
                {say : localization.NOT_EASY, percent : 40, smiley: '😯'},
                {say : localization.NOT_TOO_BAD, percent : 50, smiley: '😑'},
                {say : localization.NICE_PLAY, percent : 60, smiley: '🙂'},
                {say : localization.NOT_BAD, percent : 70, smiley: '😉'},
                {say : localization.GREAT, percent : 80, smiley: '😀'},
                {say : localization.MY_MEN, percent : 90, smiley: '😘'},
                {say : localization.IMPRESSIVE, percent : 100, smiley: '😍'}
            ];
        
            var result = goodAnswers / totalQuestion * 100;
            var lastIncentive = incentive[0];
            for (var i = 0; i < incentive.length; i++){
                if (incentive[i].percent > result)
                    break; 
                lastIncentive = incentive[i];
            }
            
            return lastIncentive + ' !';
    },
    
	SafeExtract: function (arr, paramsArr) {
    	var v = arr;
    	
    	for (var i = 0; i < paramsArr.length; i++){
    		if (typeof(v) === 'undefined')
    			return v;
    			
    		v = v[paramsArr[i]];
    	} 
    	
    	return v;
    },

    GetFirstValueFromSlot: function(slots){
        for (var slot in slots){
            if (slots[slot].value)
                return slots[slot].value;
        }
        return null;
    },

	ExtractSlotsValue: function (slots, slotName) {
		return this.SafeExtract(slots, [slotName, 'resolutions', 'resolutionsPerAuthority', 0, 'values', 0, 'value', 'name']) || this.SafeExtract(slots, [slotName, 'value']);
	},

	HasSlotsValue: function (slots, slotName) {
		if (this.SafeExtract(slots, [slotName, 'resolutions', 'resolutionsPerAuthority', 0, 'status', 'code']))
		    return true;
		else
		    return false;
	},
	
	
    IsWordInWikiResult: function(w, jsonResult) {
        w = w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        
        for (var i = 0; i < jsonResult.query.search.length; i++) {
            var res = jsonResult.query.search[i];
    
            if (res.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").indexOf(w) === 0 ||
                res.snippet.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").indexOf('<span class=\"searchmatch\">' + w + '</span>') >= 0)
                return true;
        }
        return false;
    },
    
    Spell: function(text){
        return '<say-as interpret-as="spell-out">' + text + '</say-as>';
    },
    
    Interjection: function(text) {
        return `<say-as interpret-as="interjection">${text}</say-as>`;
    },

    HttpGet(options, callback) {
        var req = https.request(options, res => {
            
            res.setEncoding('utf8');
            var responseString = "";
    
            //accept incoming data asynchronously
            res.on('data', chunk => {
                responseString = responseString + chunk;
            });
            
            //return the data when streaming is co!589-plete
            res.on('end', () => {
                callback(responseString);
            });
    
            res.on('error', (e) => {
                console.log(`problem with request: ${e.message}`);
            });
        });
        req.end();
    },

    FetchWikiResults: function(word, category, callback) {
        var options = {
            protocol:'https:',
            hostname: 'fr.wikipedia.org',
            path: (`/w/api.php?action=query&list=search&format=json&prop=categories&srsearch=intitle:${encodeURIComponent(word)}+incategory:"${encodeURIComponent(category)}"`),
            method: 'GET',
        };
        
        console.log('Call API Wiki: ', options);
        
        this.HttpGet(options, callback);
    },
    GetFailInterjection: function() {
        const failed = [localization.CRAP, localization.TRALALA, localization.MISSED, localization.NOT_EASY, localization.OUPS, localization.OULAH, localization.OOOH, localization.OLAH, localization.OH_NO, localization.DANG, localization.NOOO, localization.SNAP, localization.HALAS, localization.AAAND_NO, localization.TOO_BAD, localization.BADABOOM, localization.COME_ON];
        return this.GetRandomFromArray(failed, []) + ' !';
    },
    GetSuccessInterjection: function() {
        const success = [localization.BAM, localization.OF_COURSE, localization.BINGO, localization.BRAVO, localization.EUREKA, localization.HOURA, localization.HOLY_COW, localization.YES, localization.DUCK, localization.GREAT, localization.HERE_YOU_GO, localization.WAOUH, localization.WOO_HOO, localization.YAY, localization.YOUHOU, localization.YOUPI, localization.OMG];
        return this.GetRandomFromArray(success, []) + ' !';
    }

};