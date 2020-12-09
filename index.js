const express = require("express")
const mongodb = require("mongodb")
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const cors = require("cors")
require('dotenv').config()

const app = express();
const port = process.env.PORT || 3000;
const mongoClient = mongodb.MongoClient;
const object_id = mongodb.ObjectID;
const mongodb_url = process.env.mongo_url;
const { Authorize, Edit_check, Delete_check } = require("./auth_modules/authorize")

app.use(express.json());
app.use(cors());

async function inital_check(){
    console.log(`Running on Port-${port}`)
    let client  = await mongoClient.connect(mongodb_url);
    let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('topics');
    let result = await collection.ensureIndex({"topic":"text", "content": "text", "category": "text"})
}


app.post("/create_user", async (req, res)=>{
    console.log("test")
    let data = req.body;
    let salt = await bcrypt.genSalt(10);
    let hash = await bcrypt.hash(data["password"], salt);
    data["password"] = hash;
    data["is_active"] = true;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('users');
        let result = await collection.find({"email": data["email"]}).toArray();
        if(result.length != 0){
            return res.status(400).json({"detail": "User Already Exist"})
        }
        let response = await collection.insertOne(data);
        client.close();
        if(response['insertedCount'] == 1)
            return res.status(200).json({"detail": "Succesfully Created"})
        else
            return res.status(500).json({"detail": "Some Error Occured"})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.post("/login", async (req, res)=>{
    let data = req.body;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('users');
        let result = await collection.find({"email": data["email"]}).toArray();
        if(result.length == 0){
            return res.status(401).json({"detail": "User Not Register"});
        }
        let isValid = await bcrypt.compare(data["password"], result[0]["password"]);
        if(!isValid){
            return res.status(401).json({"detail": "Invalid Credentials"});
        }
        client.close();
        let token = await jwt.sign({"user_id": result[0]["_id"], "role": result[0]["role"], "email": result[0]["email"]}, process.env.CODE, {expiresIn: "1h"})
        if(token)
            return res.status(200).json({"detail": "Success", "token": token})
        else
            return res.status(500).json({"detail": "Some Error Occured"})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.get("/check_status", Authorize ,async (req, res)=>{
    try{
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('users');
        let result = await collection.find({"_id": req.body["user_id"]}).toArray();
        if(result.length == 0){
            return res.status(401).json({"detail": "User Not Register"});
        }
        return res.status(200).json({"name": result[0]["name"], "role": result[0]["role"]})
    }
    catch(error){
        return res.status(403).json({"detail": "Token Expired"})
    }
})

app.post("/create_topic", Authorize, async (req, res)=>{
    let data = req.body;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('topics');
        let date = new Date();
        data["created"] = date;
        data["modified"] = date;
        let response = await collection.insertOne(data);
        client.close();
        if(response['insertedCount'] == 1)
            return res.status(200).json({"detail": "Topic has been Created"})
        else
            return res.status(500).json({"detail": "Some Error Occured"})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.get("/retrive_topics", async (req, res)=>{
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('topics');
        let result = await collection.aggregate([
            {
                $sort:
                {
                    "created": -1,
                }
            },
            {
                $limit:10,
            },
            {
                $lookup:
                {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user'
                }
            },
            {
                $project:
                {
                    "by": {$arrayElemAt: ["$user.name", 0]},
                    "created": 1,
                    "topic": 1,
                    "content": 1,
                    "category": 1,
                }
            }
        ]).toArray();
        client.close();
        return res.status(200).json({"detail": "Success", result})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.post("/topic", async (req, res)=>{
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('topics');
        let result = await collection.aggregate([
            {
                $match:
                {
                    "_id": object_id(req.body["id"])
                }
            },
            {
                $lookup:
                {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user'
                }
            },
            {
                $project:
                {
                    "by": {$arrayElemAt: ["$user.name", 0]},
                    "created": 1,
                    "topic": 1,
                    "content": 1,
                    "category": 1,
                }
            }
        ]).toArray();
        client.close();
        return res.status(200).json({"detail": "Success", "result": result[0]})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.post("/create_reply", Authorize, async (req, res)=>{
    let data = req.body;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('replies');
        let date = new Date();
        data["created"] = date;
        data["modified"] = date;
        let response = await collection.insertOne(data);
        client.close();
        if(response['insertedCount'] == 1)
            return res.status(200).json({"detail": "Success"})
        else
            return res.status(500).json({"detail": "Some Error Occured"})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.post("/retrive_replies", async (req, res)=>{
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('replies');
        let result = await collection.aggregate([
            {
                $match:
                {
                    "post_id":req.body["id"]
                }
            },
            {
                $lookup:
                {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user'
                }
            },
            {
                $project:
                {
                    "by": {$arrayElemAt: ["$user.name", 0]},
                    "created": 1,
                    "content": 1,
                }
            },
            {
                $sort:
                {
                    "created": -1,
                }
            }
        ]).toArray();
        client.close();
        return res.status(200).json({"detail": "Success", result})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.put("/edit_reply", Edit_check, async (req, res)=>{
    let data = req.body;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('replies');
        let response = await collection.findOneAndUpdate({"_id": object_id(data["id"])},{$set:{"content": data["content"], "modified": new Date()}});
        if(!response['lastErrorObject']['updatedExisting']){
            return res.status(500).json({"detail": "Something Went Wrong"})
        }
        return res.status(200).json({"detail": "Success"})
    }
    catch(error){
        console.log(error);
        return res.status(500).json({"detail": "Something Went Wrong"})
    }
})

app.delete("/delete_reply", Delete_check, async (req, res)=>{
    let data = req.body;
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('replies');
        let response = await collection.deleteOne({"_id": object_id(data["id"])});
        if(response['deletedCount'] != 1){
            return res.status(500).json({"detail": "Something Went Wrong"})
        }
        return res.status(200).json({"detail": "Success"})
    }
    catch(error){
        console.log(error);
        return res.status(500).json({"detail": "Something Went Wrong"})
    }
})

app.post("/list_posts", async (req, res)=>{
    let data =  req.body;
    let query = {$text: { $search: data["topic"] } }
    if(data["st"] && data["ed"])
        query["created"] = {$gte:new Date(data["st"]), $lte:new Date(data["ed"])}
    else if(data["st"])
        query["created"] = {$gte:new Date(data["st"])}
    else if(data["ed"])
        query["created"] = {$lte:new Date(data["ed"])}
    if(data["limit"])
        query["limit"] = data["limit"]
    try {
        let client  = await mongoClient.connect(mongodb_url);
        let collection = client.db("guvi_DailyTask(DT)_12-05-2020").collection('topics');
        let result = await collection.aggregate([
            {
                $match: query,
            },
            {
                $lookup:
                {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user'
                }
            },
            {
                $project:
                {
                    "by": {$arrayElemAt: ["$user.name", 0]},
                    "created": 1,
                    "topic": 1,
                    "content": 1,
                    "category": 1,
                }
            }
        ]).toArray();
        client.close();
        return res.status(200).json({"detail": "Success", "result": result})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"detail": "Some Exception Occured"})
    }
})

app.listen(port, inital_check)