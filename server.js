const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Model for username
const usernameSchema = new mongoose.Schema({username: {type: String, required: true}});
const Username = mongoose.model('Username', usernameSchema);

// Exercise tracker post handler for new user creation
app.post('/api/exercise/new-user', (req, res, next) => {
  const newUser = req.body.username;
  Username.find({username: newUser}).exec( (err, data) => {
    if (data.length != 0){
      var err = new Error('username already taken');
      err.status = 401;
      return next(err);
    }
    else {
      Username.create({username: newUser}, (err, data) => {
        res.json(  (({username, _id}) => ({username, _id}))(data) )
      })
    }
  })
})

// Post handler for adding new exercises
const exerciseSchema = new mongoose.Schema({username: {type: String, required: true},
                                           description: {type: String, required: true},
                                           duration: {type: Number, required: true},
                                           date: 'Date'});
const Exercise = mongoose.model('Exercise', exerciseSchema);

const findUsername = (userId, next) => {
  Username.findById(userId).exec( (err, user) => {
    if (user==null) {
      var err = new Error('unknown _id');
      err.status = 400;
      return next(err);
    }
    else if (err) return next(err);
    else return next(err, user);
  });
}


app.post('/api/exercise/add', (req, res, next) => {
  Username.findById(req.body.userId).exec( (err, user) => {
    if (user==null) {
      var err = new Error('unknown _id');
      err.status = 400;
      return next(err);
    }
    else if (err) return next(err);
    else {
      var date = req.body.date == "" ? new Date():new Date(req.body.date) == "Invalid Date"? req.body.date :new Date(req.body.date);
      Exercise.create({username: user.username,
                      description: req.body.description,
                      duration: req.body.duration,
                      date: date}, (err, newEntry) => {
        if(err) {
          return next(err);
        }
        res.json({
          username: newEntry.username,
          description: newEntry.description,
          duration: newEntry.duration,
          _id: user._id,
          date: newEntry.date.toDateString()
        });
      })
    }
  });
})

// GET handler for user exercise log
app.get('/api/exercise/log', (req, res, next) => {
  console.log(req.query);
  findUsername(req.query.userId, (err, user) => {
    if (err) return next(err);
    
    var query = {username:user.username};
    var options = {};
    if (req.query.from && new Date(req.query.from)!="Invalid Date") {
      query.date = {};
      query.date.$gte = new Date(req.query.from)
    };
    if (req.query.to && new Date(req.query.to)!="Invalid Date") {
      if (!query.hasOwnProperty('date')) query.date = {};
      query.date.$lte = new Date(req.query.to)
    };
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    
    console.log(options);
    Exercise.find(query, null, options)
            .exec( (err, lst) => {
      if (err) return next(err);
      
      // log generator
      var output = {
        _id: user._id,
        username: user.username
      };
      
      if(query.date) {
        if (query.date.$gte) output.from = query.date.$gte.toDateString();
        if (query.date.$lte) output.to = query.date.$gte.toDateString();
      }
      
      output.count = Object.keys(lst).length;
      
      output.log = Object.keys(lst).reduce((a,b)=>{
                  a[b] = {description: lst[b].description,
                  duration: lst[b].duration,
                  date: lst[b].date.toDateString()
                 };
                return a}, {});
      
      res.json(output);
    });
  })
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
