1. add middleware to use between router and controller, router will check the argument of request body before to send controller
2. add class AppError to controle all errors come from the application, not come from the systeme of http, use in level service to throw a error of our application, with a message and statuscode
3. level controller with cath all type of errors, check the error if commes from AppError( error instanceof AppError), if not, use errorcode 500 



fonctionnement of test: 
1. test with https in navigator： 
    - line of url: in navigator when we put https://localhost:8888/login, nginx get this dynamique request, will return to http://localhost:3000/api/login, to call the router of login to find response 
    - clique droit find inspect, onglet network to check the request and response 
2. test with curl: 
    - in terminal: curl -k (use to skipp the ssl) -X POST -H "Content-Type: application/json" -d '{"password": "1234864595", "email": "48e656@gmail.com", "username": "fegf8978d"} https://localhost:8888/login 
    -with application Insomnia: need to entry all type de request also 

to do list: 
    1. check the statuscode for error in Auth, like email exist already, cannot find 
    2. finish profile for backend, need to redirection for front 
    