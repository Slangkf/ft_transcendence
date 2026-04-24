1. register: need regirection to "/modes" 
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

2. login: need redirection to "/mode"
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
      })
    response: 
        200
        message logged out in json
