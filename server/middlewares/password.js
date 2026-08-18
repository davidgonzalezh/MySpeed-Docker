import * as config from '../controller/config.js';
import bcrypt from 'bcryptjs';
import { readPasswords } from '../util/passwordHeader.js';

export default (allowViewAccess) => async (req, res, next) => {
    if (process.env.PREVIEW_MODE === "true") return next();

    let passwordHash = await config.getValue("password");
    let passwordLevel = await config.getValue("passwordLevel");

    if (passwordHash === "none") {
        req.viewMode = false;
        return next();
    }

    if (readPasswords(req).some(candidate => bcrypt.compareSync(candidate, passwordHash))) {
        req.viewMode = false;
        return next();
    }

    if (passwordLevel === "read" && allowViewAccess) {
        req.viewMode = true;
        return next();
    }

    return res.status(401).json({message: "Please provide the correct password in the header"});
};