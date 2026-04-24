1. register: need regirection to "/profil" 
    fetch ("/api/auth/register", {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
      },
        body: JSON.stringify({
            username,
            email,
            password
        })
    })
    error: 
        - 409: email alredy exist (maybe un window to do alerte)
        - 500: systeme error(dont need to traite)
    response: 
        201 success to create
        UserOutput in json 

2. login: need redirection to "/profil"
    fetch ("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
        "Content-Type": "application/json"
      },
        body: JSON.stringify({
            email,
            password
        })
    })
    error: 
        -401: Invalid credentials
        -500: systeme error(ignore)
    response:
        - 200 success
        - UserOutput in json 

3. profil: 
    fetch ("/api/user/me", {
        method: "GET",
        credentials: "include"
    })
    error: 
        - 500 system error(ignore)
        - 401 user not exist
    response: 
        200
        UserOutput in json 

4. changepassword: 
    fetch ("/api/user/me/changepassword", {
        method: "POST",
        credentials: "include",
        headers: {
        "Content-Type": "application/json"
      },
        body: JSON.stringify({
            oldpassword,
            newpassword,
            confirmpd
        })
    })
    error: 
        - 404: user not found 
        - 401: old password not correct
        - 400: new password is same as old 
        - 500: systeme(ignore)
    response:
        200
        
5. logout: 
    fetch ("/api/user/logout", {
        method: "GET",
        credentials: "include",
        "Content-Type": "application/json"
      }
    })
    response: 
        200
        message logged out in json
6.  start a game: 
    fetch ("/api/game/:mode/start, {
        methode: "POST",
        credentials: "include",
    })
    error: 
    reponse: like en bas, il y a les infos de question sans reponse et 
    
    gameid 

{
	"success": true,
	"message": "Game started",
	"data": {
		"gameId": "cb06def2-f0cf-400e-a16c-602f11872e38",
		"question": {
			"id": 591,
			"question": "Qui est le meilleur buteur de l'histoire de Manchester United en Premier League ?",
			"options": [
				"Wayne Rooney",
				"Sir Bobby Charlton",
				"Ryan Giggs",
				"David Beckham"
			]
		}
	},
	"error": null
}


7. submit answer:
    fetch ("/api/game/:mode/:gameId/answer, {
        methode: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            selectedAnswerIndex,
        })
    })

    reponse:     - in game: like this(une partie de game result, quel joueur a combien le score, et une autre partie stuts de game, et la bonne reponse a utiliser pour afficher la bonne(peut etre plus pratique d'avoir index directement, a changer apres), et la prochaine question )
        - game termine: normalement le score de chaque players
    {
	"success": true,
	"message": "Answer submitted.",
	"data": {
		"gameresult": {
			"gameId": "1ea07c0d-5614-44a1-8730-29ba313096a6",
			"players": {
				"3": {
					"id": 3,
					"score": 1,
					"isAI": false,
					"Totaltime": 0
				}
			},
			"currentQuestionIndex": 3,
			"isFinished": false,
			"totalQuestions": 10
		},
		"correctAnswer": "Biologie",
		"nextQuestion": {
			"id": 317,
			"question": "Comment appelle-t-on un polygone à 4 côtés égaux et des angles à 90 degrés ?",
			"options": [
				"Carré",
				"Rectangle",
				"Losange",
				"Trapèze"
			]
		}
	},
	"error": null
}