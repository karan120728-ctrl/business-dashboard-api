require("dotenv").config();
const express = require("express");
const connectDB = require("./db/connection");

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());

// connect DB
connectDB();

// test route
app.get("/", (req, res) => {
  res.send("Business Dashboard API is running");
});

// user routes
const userRoute = require("./routes/user.route"); // check filename
app.use("/api/users", userRoute);

// customer routes
const customerRoutes = require("./routes/customer.route");
app.use("/api/customer", customerRoutes);

// product routes
const productRoute = require("./routes/product.route");
app.use("/api/products", productRoute);

// order routes
const orderRoute = require("./routes/order.route");
app.use("/api/orders", orderRoute);


// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
