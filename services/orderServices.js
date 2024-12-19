import Order from "../models/orderModel.js";
import Customer from "../models/customerModel.js";
import { Category, Dish } from "../models/dishModel.js";
import Table from "../models/tableModel.js"
import Bill from "../models/billModel.js"
import { createBill, updateBillDishes } from "./billServices.js";
import { ClientError, ServerError } from "../utils/errorHandler.js";


export const onQRScanService = async ({ tableId, hotelId }) => {

    const table = await Table.findById(tableId).select('sequence status')

    if (!table) {
        throw new ClientError('Table not found!');
    }

    const customer = await Customer.findOne({ tableId, hotelId });

    const orders = await Order.find({ tableId, hotelId })
    if ((orders.length > 0 && !customer) || (orders.length > 0 && orders[0].customerId != customer._id.toString())) {
        throw new ServerError("Orders are available while customer is not");
    }
    let bill = null
    if (orders.length > 0)
        bill = await Bill.findById(customer.billId).select('totalAmount totalDiscount finalAmount status')

    // for creating menu 
    const dishes = await Dish.find({ hotelId });
    const categories = await Category.find({ hotelId });


    const data = {
        table: table,
        customerName: customer?.name,
        existingOrders: orders,
        menu: {
            dishes,
            categories
        },
        bill
    };

    return data;
}

export const addNewOrderService = async (orderData, session) => {
    try {
        const { customerName, tableId, hotelId, dishes, status, note } = orderData;

        // Step 1: Check if customer exists for the given tableId
        let customer = await Customer.findOne({ tableId }).session(session);

        // Step 2: Create or Update the bill
        let bill;
        if (!customer) {
            bill = await createBill({ customerName, hotelId, tableId, dishes, session });
            customer = new Customer({
                hotelId,
                tableId,
                name: customerName,
                billId: bill._id,
            });
            await customer.save({ session });
        } else {
            bill = await updateBillDishes({ billId: customer.billId, newDishes: dishes, session });
        }

        // Step 3: Create a new order without population
        const newOrder = new Order({
            customerId: customer._id,
            billId: bill._id,
            dishes: dishes.map(dish => ({
                dishId: dish._id,
                quantity: dish.quantity,
                notes: dish.notes
            })),
            status: status || 'draft',
            tableId,
            hotelId,
            note: note || '',
        });

        await newOrder.save({ session });
        return newOrder;

    } catch (error) {
        console.error('Error in addNewOrderService:', error);
        throw new ServerError(error.message);
    }
};

// only for hotel owner
export const updateOrderService = async (orderData, session) => {
    try {
        const { orderId, status, note } = orderData;
        let dishes = orderData.dishes;

        // Step 1: Find the existing order by ID
        const order = await Order.findById(orderId).session(session);
        const oldOrder = { ...order.toObject() };

        if (!order) {
            throw new ClientError("Order not found");
        }

        dishes = dishes?.filter((item) => item.quantity >= 0);
        // Step 2: Update the order details
        if (dishes && dishes.length > 0) {
            // Update the dishes
            dishes.forEach(newDish => {
                const existingDish = order.dishes.find(dish => dish.dishId.toString() === newDish._id.toString());

                if (existingDish) {
                    // If the dish exists, update the quantity
                    existingDish.quantity = Number(newDish.quantity);

                    // Ensure quantity does not go below zero
                    if (existingDish.quantity <= 0) {
                        order.dishes = order.dishes.filter(dish => dish.dishId.toString() !== newDish._id.toString());
                    }
                } else if (Number(newDish.quantity) > 0) {
                    // If the dish doesn't exist, add it only if quantity is positive
                    order.dishes.push({
                        dishId: newDish._id,
                        quantity: Number(newDish.quantity),
                        note: newDish.note || ''
                    });
                }
            });
        }

        // Update status if provided
        if (status) {
            order.status = status;
        }

        // Update note if provided
        if (note) {
            order.note = note;
        }

        // Save the updated order
        await order.save({ session });

        // Update the associated bill
        if (dishes && dishes.length > 0) {
            const billId = order.billId
            await updateBillDishes({ billId, oldOrder, newDishes: dishes, session });
        }

        return order;
    } catch (error) {
        throw new ServerError(error.message); // Replace with your error handling logic
    }
};

// only for hotel owner
export const deleteOrderService = async (orderId, session) => {
    try {

        // Step 1: Find the order by ID
        const order = await Order.findById(orderId).session(session);

        if (!order) {
            throw new ClientError("Order not found");
        }

        // Step 2: Extract billId and dishes from the order
        const { billId, dishes } = order;

        if (!billId) {
            throw new ServerError("Bill ID not found in the order");
        }

        // Step 3: Delete the order
        await Order.findByIdAndDelete(orderId, { session });

        // Step 4: Update the associated bill
        const updateDishes = dishes.map(dish => ({
            _id: dish.dishId,
            quantity: 0,
        }));

        const bill = await updateBillDishes({ billId, oldOrder: order, newDishes: updateDishes, session });

        return order;

    } catch (error) {
        throw new ServerError(error.message); // Replace with your error handling logic
    }
};

export const getOrderDetailsService = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate('billId', '_id amount')
      .populate('customerId', '_id name')
      .populate('dishes.dishId', '_id name price')
      .populate('tableId', '_id number')
      .populate('hotelId', '_id name');

    if (!order) {
      throw new ClientError('Order not found');
    }

    return order;
  } catch (error) {
    console.error('Error in getOrderDetailsService:', error);
    throw new ServerError(error.message);
  }
};

export const getAllOrderService = async () => {
  try {
    const orders = await Order.find({})
      .populate('customerId', '_id name')
      .populate('dishes.dishId', '_id name price')
      .populate('tableId', '_id sequence')
      .populate('hotelId', '_id name');

    if (!orders) {
      throw new ClientError('Order not found');
    }

    return orders;
  } catch (error) {
    console.error('Error in getOrderDetailsService:', error);
    throw new ServerError(error.message);
  }
};


