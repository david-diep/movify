# Movify
A dynamic mobile-responsive web application for movie enthusiasts who want to journal, track and categorize their movie interests. 

## Live Site
Try the live site here: https://movify.david-diep.com/  
An account you can use to test the website is:  
Username: cody@gmail.com  
Password: coding  

Here's an example of what it looks like:  
![Movify](https://i.imgur.com/X8mV569.png "Movify") 

## Technologies Used
<li>React</li>
<li>Node.js</li>
<li>Express</li>
<li>PostgresQL</li>
<li>Bootstrap</li>
<li>reactstrap</li>
<li>Webpack</li>
<li>Babel</li>
<li>HTML</li>
<li>CSS</li>
<li>multer</li>
<li>Amazon Web Services EC2</li>

## Main Features
- User can search for movies or users of the app.  
- User can view the details of a movie (including synopsis, reviews, similar movies).  
- User can view, create or delete a custom list.   
- User can add or delete movie from a custom list.   
- User can view, add or delete movies from their favorites or watch list.   
- User can view, create, delete, or update their reviews of a movie.   
- User can view, send, and delete messages from other users.   
- User can edit and view their own and view other users' profiles (including uploading their own profile image).  
- User can sign in, create an account, and log out.   
- User can sort and filter movies by different genres & categories.

## Development
### System Requirements
- Node.js  
- NPM  
- PostgreSQL  

### Getting Started
1. Clone the repository.  

   ```git clone https://github.com/david-diep/movify.git```

2. Install all dependencies.   

   ```npm install```


3. Start PostgreSQL server.  

   ```sudo service postgresql start```


4. Create the database.  

   ```createdb movify```


5. Copy and rename ```.env.example``` to ```.env``` and update with your PostgreSQL credentials.  


6. Import the database.  

   ```npm run db:import```


7. Start the project.  

   ```npm run dev```

 A local copy should then be accessible at localhost:3000 or the localhost:DEV_SERVER_PORT specified in the .env folder.  

