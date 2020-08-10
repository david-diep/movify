require('dotenv/config');
const express = require('express');
const db = require('./database');
const ClientError = require('./client-error');
const staticMiddleware = require('./static-middleware');
const sessionMiddleware = require('./session-middleware');
const fetch = require('node-fetch');
const promise = require('promise');

const app = express();

const apiKey = '9dbf824ef684a8b724b9b0e090bb97d9';

const path = require('path');
const multer = require('multer');
const upload = multer({
  dest: path.join(__dirname, 'public/images/user-images/')
  //, limits: { fileSize: 2 * 1000 * 1000 } // image upload limit for 2MB
});
const fs = require('fs');

app.use(staticMiddleware);
app.use(sessionMiddleware);

app.use(express.json());

app.post('/api/users/image/:userId', upload.single('image'), (req, res, next) => {
  // image refers to the name of the file-input on user-profile
  const userId = req.params.userId;
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, `public/images/user-images/${userId}${path.extname(req.file.originalname)}`);

  if (['.png', '.jpg'].includes(path.extname(req.file.originalname).toLowerCase())) {
    fs.rename(tempPath, targetPath, err => {
      if (err) throw (new ClientError('fs error', 500));
    });
    // after the file is created send target path to sql
    const sql = `
      update "users"
      set "imageURL" = $2
      where "userId" = $1
      `;
    const params = [userId, `../images/user-images/${userId}${path.extname(req.file.originalname)}`];
    db.query(sql, params)
      .then(result => res.sendStatus(201))
      .catch(err => next(err));
  } else {
    fs.unlink(tempPath, err => {
      if (err) throw (new ClientError('fs error - must use .png or .jpg file', 500));
    });
  }
});

app.post('/api/search', (req, res, next) => {

  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${req.body.query}&page=1&include_adult=false`)
    .then(result => result.json()
    )
    .then(data => {

      return res.json(data.results);
    })
    .catch(error => next(error));

});

// post request for search by genre
app.post('/api/search/genre', (req, res, next) => {
  // when the query results returned from the api
  // filter through (maxPage) of results returned until maxPage is reached or results reach 20
  // page limit(maxPages) is in place to prevent long load times
  const results = [];
  const filter = req.body.filter;
  var page = 0; // page increments before fetch is called, so it starts at 1
  let maxPage;
  if (!req.body.filter) {
    throw (new ClientError('filter is needed in request body', 400));
  } else {
    lookAtPages();
  }
  // recursive function is used when there aren't enough results and when page limit isn't met
  function lookAtPages() {
    page++;
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${req.body.query}&page=${page}&include_adult=false`)
      .then(result => result.json()
      )
      .then(data => {
        if (maxPage === undefined) { // decide the max number of pages to search through
          if (data.total_pages <= 14) {
            maxPage = data.total_pages;
          } else {
            maxPage = 14;
          }
        }
        for (let i = 0; i < data.results.length; i++) {
          const movie = data.results[i];
          const movieGenres = movie.genre_ids;
          let flag = false;
          for (let x = 0; x < filter.length; x++) {
            if (!movieGenres.includes(filter[x])) {
              flag = true;
            }
          }
          if (flag) {
            continue;
          } else {
            results.push(data.results[i]);
          }
        }
        if (results.length < 20 && page < maxPage) {
          lookAtPages();
        } else {
          return res.json(results);
        }
      })
      .catch(error => next(error));
  }
});
/* get request for api/details endpoint
notes: need to include name to reviews too. grab it from users table using userId?
*/
app.get('/api/details/:movieId', (req, res, next) => {
  const movieId = req.params.movieId;

  promise.all([
    fetch(`https://api.themoviedb.org/3/movie/${movieId}/reviews?api_key=${apiKey}&language=en-US&page=1`)
      .then(res => res.json()),
    fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=en-US`)
      .then(res => res.json()),
    fetch(`https://api.themoviedb.org/3/movie/${movieId}/recommendations?api_key=${apiKey}&language=en-US&page=1`)
      .then(res => res.json()),
    fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=en-US`)
      .then(res => res.json())
  ])
    .then(data => {
      res.json(data);
    })
    .catch(error => next(error));

  // const sql = `
  //     select "rating", "content"
  //     from "reviews"
  //     where "movieId" = $1
  //   `;

  // const params = [movieId];
  // db.query(sql, params)
  //   .then(result => {
  //     const review = result.rows[0];
  //     if (!review) {
  //       next(new ClientError('No reviews currently exist', 404));
  //     } else {
  //       res.status(200).json(review);
  //     }
  //   })
  //   .catch(error => next(error));
});
// end feature: user-can-view-details

// POST request for home page to get trending or top rated movies
app.post('/api/home', (req, res, next) => {
  if (req.body.category === 'trending') {
    fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${apiKey}`)
      .then(result => result.json()
      )
      .then(data => res.json(data.results))
      .catch(err => next(err));
  } else {
    fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&language=en-US&page=1`)
      .then(result => result.json()
      )
      .then(data => res.json(data.results))
      .catch(err => next(err));
  }
});

// GET request to get user details
app.get('/api/users/:userId', (req, res, next) => {
  const id = req.params.userId;
  const sql = `
    select "users"."userId",
      "users"."name",
      "users"."bio",
      "users"."imageURL"
      from "users"
    where "userId" = $1
  `;
  const params = [id];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError(`user ${id} not found `, 404));
      } else {
        res.json(result.rows[0]);
      }
    })
    .catch(err => next(err));
});

// PATCH request to update user details
app.patch('/api/users/:userId', (req, res, next) => {
  const id = req.params.userId;
  if (!req.body.bio) {
    throw (new ClientError('bio is needed', 400));
  }
  const sql = `
    update "users"
    set "bio" = $2
    where "userId" = $1
  `;
  const params = [id, req.body.bio];
  db.query(sql, params)
    .then(result => res.sendStatus(200))
    .catch(err => next(err));
});

// POST request for user can write review
app.post('/api/reviews', (req, res, next) => {
  const movieId = req.body.movieId;
  const userId = req.body.userId;
  const rating = req.body.rating;
  const reviewContent = req.body.content;

  if (movieId < 1 || isNaN(movieId)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  if (!userId || !rating || !reviewContent) {
    res.status(400).json({ error: 'missing content' });
    return;
  }

  const sql = `
    insert into "reviews" ("userId", "rating", "content", "movieId" )
    values ($1, $2, $3, $4)
    returning *;
  `;

  const params = [userId, rating, reviewContent, movieId];

  db.query(sql, params)
    .then(response => {
      if (!response.rows[0]) {
        res.status(404).json({ error: 'cannot review movie' });
      } else {
        res.status(201).json(response.rows[0]);
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'an unexpected error occurred' });
    });
});

// PATCH request for User Can Edit Own Review
app.patch('/api/reviews/:reviewId', (req, res, next) => {
  const reviewId = req.params.reviewId;
  const rating = req.body.rating;
  const reviewContent = req.body.content;

  if (reviewId < 1 || isNaN(reviewId)) {
    res.status(400).json({ error: 'invalid review id' });
    return;
  }
  if (!rating || !reviewContent) {
    res.status(400).json({ error: 'missing required information' });
    return;
  }

  const sql = `
  update "reviews"
    set "rating" = $1, "content" = $2
    where "reviewId" = $3
    returning *
  `;

  const params = [rating, reviewContent, reviewId];

  db.query(sql, params)
    .then(result => res.sendStatus(200))
    .catch(err => next(err));
}); // end of PATCH request for User Can Edit Own Review

// GET request for User Can View Self/Other User Reviews
app.get('/api/reviews/:userId', (req, res, next) => {
  const userId = req.params.userId;
  const sql = `
  select *
    from "reviews"
    where "reviewId" = $1
  `;
  const params = [userId];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
      } else {
        res.status(200).json(result.rows);
      }
    })
    .catch(err => next(err));
}); // end of GET request for User Can View Self/Other User Reviews

app.get('/api/lists/:userId', (req, res, next) => {
  const id = req.params.userId;
  const sql = `
    select *
      from "lists"
    where "userId" = $1
  `;
  const params = [id];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// DELETE request to delete a list
app.delete('/api/lists/:listId', (req, res, next) => {
  const id = req.params.listId;
  const sql = `
      delete from "lists" where "listId" = $1
      returning *
  `;
  const params = [id];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// POST request to create a new list
app.post('/api/lists/:userId', (req, res, next) => {
  const id = req.params.userId;
  const name = req.body.name;
  const sql = `
    insert into "lists" ("userId", "type","name")
    values ($1, 'custom', $2)
    returning *
  `;
  const params = [id, name];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// POST request to add a movie to a list
app.post('/api/lists/add/:listId', (req, res, next) => {
  const id = req.params.listId;
  const movieId = req.body.movieId;
  const title = req.body.title;
  const description = req.body.description;
  const posterURL = req.body.posterURL;
  const releaseDate = req.body.release_date;
  const sql1 = `select * from "listItems"
  where "listId" = $1 and "movieId" = $2`;

  const sql2 = `
  insert into "listItems"("listId", "movieId")
  values($1, $2)
  returning *
    `;

  const sql3 = `select * from "movies"
  where "movieId" = $1`;

  const sql4 = `insert into "movies" ("title", "movieId", "description", "posterURL", "reviews", "releaseDate")
  values($1, $2, $3, $4, $5, $6)
  returning * `;

  const params = [id, movieId];
  // checks if movie is already in that users list, if it isnt then add to list table
  db.query(sql1, params)
    .then(result => {
      if (result.rows.length < 1) {
        return db.query(sql2, params)
          .then(result2 => {
            if (result2.rows.length < 1) {
              next(new ClientError('some error occurred', 404));
            } else {
              // checks if movie is already in movies list, if it isnt then add to movies table
              return db.query(sql3, [movieId])
                .then(result3 => {
                  if (result3.rows.length < 1) {
                    db.query(sql4, [title, movieId, description, posterURL, { reviews: 'not yet' }, releaseDate])
                      .then(result4 => res.json(result4.rows));
                  } else {
                    next(new ClientError('movie already in movies table', 404));
                  }
                });
            }
          });
      } else {
        next(new ClientError('movie is already in users list ', 404));
      }
    })
    .catch(err => next(err));
});

// GET request to get all movies in a list
app.get('/api/listItems/:listId', (req, res, next) => {
  const id = req.params.listId;
  const sql = `
    select *
      from "listItems"
      join "movies" using ("movieId")
    where "listId" = $1
  `;
  const params = [id];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('no items in list', 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

app.delete('/api/listItems/:listId/:movieId', (req, res, next) => {
  const listId = req.params.listId;
  const movieId = req.params.movieId;
  const sql = `
    delete from "listItems"
    where "listId" = $1 and "movieId" = $2
    returning *
  `;
  const params = [listId, movieId];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('item not found to delete', 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// User can Login
app.post('/api/login/', (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const value = [email, password];
  const sql = `
  select *
  from "users"
  where "email" = $1 and "password" = $2
  `;

  db.query(sql, value)
    .then(result => {
      const userInfo = result.rows[0];
      if (!userInfo) {
        res.json({ message: 'wrong email or password' });
      } else {
        req.session.userInfo = userInfo;
        return res.json(req.session);
      }
    })
    .catch(err => {
      return res.send({ message: err });
    });
});

// User can sign up
app.post('/api/signup/', (req, res, next) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const params = [email];
  const sql = `
    select *
    from "users"
    where "email" = $1
  `;
  const sql2 = `
    insert into "users" ("name", "email", "password")
         values ($1, $2, $3)
         returning *;
  `;

  const sql3 = `
  insert into "lists" ("userId", "type","name")
    values ($1, 'favorites', 'My Favorites List')`;
  const sql4 = `;
    insert into "lists" ("userId", "type","name")
    values ($1, 'watch', 'My Watch List')`;
  db.query(sql, params)
    .then(result => {
      const newUser = result.rows[0];
      if (newUser) {
        return res.status(400).json({
          error: 'email already taken'
        });
      } else {
        db.query(sql2, [name, email, password])
          .then(result => {
            const userInfo = result.rows[0];
            req.session.userInfo = userInfo;
            db.query(sql3, [userInfo.userId]).then(data => {
              db.query(sql4, [userInfo.userId]).then(data => {
                return res.json(req.session);
              });
            });
          });

      }
    })
    .catch(err => {
      return res.send({ message: err.message });
    });
});

// User can Log Out
app.post('/api/logOut/', (req, res, next) => {
  req.session.userInfo = null;
});

// get all other users besides userId (yourself)
app.get('/api/search/users/:userId', (req, res, next) => {
  const userId = req.params.userId;
  const sql = `
    select "name", "bio", "email", "imageURL", "userId"
    from "users"
    where "userId" != $1
  `;
  const params = [userId];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('no items in list', 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// delete reviews
app.delete('/api/reviews/:reviewId', (req, res, next) => {
  const reviewId = req.params.reviewId;
  const sql = `
    delete from "reviews" where "reviewId" = $1
    returning *
  `;
  const params = [reviewId];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('no items in list'), 404);
      } else {
        res.json(result.rows);
      }
    })
    .catch(error => next(error));
});

// get all messages where sentId is equal to userId
app.get('/api/messages/:userId', (req, res, next) => {
  const userId = req.params.userId;
  const sql = `
    select "senderId", "content", "sentAt", "name"
    from "messages"
    join "users" on "users"."userId" = "messages"."senderId"
    where "recipientId" = $1
  `;

  const params = [userId];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('no messages found', 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

// send a message from userId (sentId) to recipientId
app.post('/api/messages/:userId', (req, res, next) => {
  const userId = req.params.userId;
  const recipientId = req.body.recipientId;
  const content = req.body.content;
  const sql = `
    insert into "messages" ("senderId", "recipientId", "content")
    values ($1, $2, $3)
    returning *
  `;
  const params = [userId, recipientId, content];
  db.query(sql, params)
    .then(result => {
      if (result.rows.length < 1) {
        next(new ClientError('no messages found', 404));
      } else {
        res.json(result.rows);
      }
    })
    .catch(err => next(err));
});

app.use((err, req, res, next) => {
  if (err instanceof ClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({
      error: 'an unexpected error occurred'
    });
  }
});

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port', process.env.PORT);
});
