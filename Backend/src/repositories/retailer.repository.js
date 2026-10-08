const {
  User,
  RetailerProfile,
  WholesalerProfile,
  WholesalerRetailerRelationship,
  Cart,
  Address,
  Return,
  Wishlist,
  SupportTicket,
  Order,
  Product,
} = require('../models');

class RetailerRepository {
  static async findUserById(userId) {
    return User.findById(userId).populate('retailerProfile');
  }

  static async findProfileByUserId(userId) {
    return RetailerProfile.findOne({ userId });
  }

  static async updateProfile(userId, updateData) {
    return RetailerProfile.findOneAndUpdate({ userId }, updateData, { new: true });
  }

  static async findActiveRelationship(retailerId) {
    return WholesalerRetailerRelationship.findOne({
      retailerId,
      status: 'ACTIVE',
    }).populate('wholesalerId', 'name email phone status');
  }

  static async findWholesalerProfile(wholesalerUserId) {
    return WholesalerProfile.findOne({ userId: wholesalerUserId });
  }

  static async findCart(retailerId) {
    return Cart.findOne({ retailerId }).populate('items.productId');
  }

  static async getOrCreateCart(retailerId, wholesalerId = null) {
    let cart = await Cart.findOne({ retailerId });
    if (!cart) {
      cart = await Cart.create({
        retailerId,
        wholesalerId,
        items: [],
        subtotal: 0,
        tax: 0,
        grandTotal: 0,
      });
    }
    return cart;
  }

  static async saveCart(cart) {
    return cart.save();
  }

  static async clearCart(retailerId) {
    return Cart.findOneAndUpdate(
      { retailerId },
      { items: [], subtotal: 0, tax: 0, grandTotal: 0 },
      { new: true }
    );
  }

  static async findAddresses(userId) {
    return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  static async findAddressById(addressId, userId) {
    return Address.findOne({ _id: addressId, userId });
  }

  static async createAddress(addressData) {
    const formatted = {
      userId: addressData.userId,
      type: addressData.type || 'BOTH',
      recipientName: addressData.recipientName || addressData.fullName || addressData.name || 'Retailer',
      phone: addressData.phone,
      businessName: addressData.businessName || '',
      street: addressData.street || addressData.addressLine1 || '',
      city: addressData.city,
      state: addressData.state,
      pincode: addressData.pincode || addressData.postalCode || '',
      country: addressData.country || 'India',
      isDefault: Boolean(addressData.isDefault),
    };
    if (formatted.isDefault) {
      await Address.updateMany({ userId: formatted.userId }, { isDefault: false });
    }
    return Address.create(formatted);
  }

  static async updateAddress(addressId, userId, updateData) {
    const formatted = { ...updateData };
    if (updateData.fullName) formatted.recipientName = updateData.fullName;
    if (updateData.addressLine1) formatted.street = updateData.addressLine1;
    if (updateData.postalCode) formatted.pincode = updateData.postalCode;
    if (formatted.isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }
    return Address.findOneAndUpdate({ _id: addressId, userId }, formatted, { new: true });
  }

  static async deleteAddress(addressId, userId) {
    return Address.findOneAndDelete({ _id: addressId, userId });
  }

  static async setDefaultAddress(addressId, userId) {
    await Address.updateMany({ userId }, { isDefault: false });
    return Address.findOneAndUpdate({ _id: addressId, userId }, { isDefault: true }, { new: true });
  }

  static async findWishlist(retailerId) {
    let wishlist = await Wishlist.findOne({ retailerId }).populate('products');
    if (!wishlist) {
      wishlist = await Wishlist.create({ retailerId, products: [] });
    }
    return wishlist;
  }

  static async addToWishlist(retailerId, productId) {
    return Wishlist.findOneAndUpdate(
      { retailerId },
      { $addToSet: { products: productId } },
      { upsert: true, new: true }
    ).populate('products');
  }

  static async removeFromWishlist(retailerId, productId) {
    return Wishlist.findOneAndUpdate(
      { retailerId },
      { $pull: { products: productId } },
      { new: true }
    ).populate('products');
  }

  static async findReturns(retailerId, query = {}) {
    const filter = { retailerId };
    if (query.status) filter.status = query.status;
    return Return.find(filter).populate('orderId').sort({ createdAt: -1 });
  }

  static async findReturnById(returnId, retailerId) {
    return Return.findOne({ _id: returnId, retailerId }).populate('orderId items.productId');
  }

  static async createReturn(returnData) {
    return Return.create(returnData);
  }

  static async findSupportTickets(retailerId) {
    return SupportTicket.find({ creatorId: retailerId }).sort({ updatedAt: -1 });
  }

  static async findSupportTicketById(ticketId, retailerId) {
    return SupportTicket.findOne({ _id: ticketId, creatorId: retailerId });
  }

  static async createSupportTicket(ticketData) {
    return SupportTicket.create(ticketData);
  }

  static async addSupportMessage(ticketId, retailerId, messageData) {
    return SupportTicket.findOneAndUpdate(
      { _id: ticketId, creatorId: retailerId },
      {
        $push: { messages: messageData },
        status: 'WAITING_FOR_USER',
        updatedAt: new Date(),
      },
      { new: true }
    );
  }
}

module.exports = RetailerRepository;
