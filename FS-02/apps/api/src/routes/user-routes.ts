import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "@aureva/database";
import { passwordSchema } from "@aureva/shared";
import { authenticate, clearAuthCookies } from "../auth";
import { AppError, asyncRoute, ok, validate } from "../http";
import { z } from "zod";

export const userRoutes=Router();
userRoutes.use(authenticate);

userRoutes.get("/users/me/profile",asyncRoute(async(request,response)=>{
  const user=await prisma.user.findUniqueOrThrow({where:{id:request.user!.id},select:{id:true,name:true,email:true,avatarUrl:true,emailVerifiedAt:true,createdAt:true,customerProfile:true}});
  return ok(response,user);
}));

userRoutes.put("/users/me/profile",asyncRoute(async(request,response)=>{
  const input=validate(z.object({name:z.string().trim().min(2).max(100),avatarUrl:z.string().url().optional().nullable(),phone:z.string().trim().min(7).max(20).optional().nullable(),dateOfBirth:z.coerce.date().max(new Date()).optional().nullable()}),request.body);
  const user=await prisma.$transaction(async tx=>{const value=await tx.user.update({where:{id:request.user!.id},data:{name:input.name,avatarUrl:input.avatarUrl??null,customerProfile:{upsert:{create:{phone:input.phone??null,dateOfBirth:input.dateOfBirth??null},update:{phone:input.phone??null,dateOfBirth:input.dateOfBirth??null}}}},select:{id:true,name:true,email:true,avatarUrl:true,emailVerifiedAt:true,customerProfile:true}});await tx.auditLog.create({data:{actorId:request.user!.id,action:"PROFILE_UPDATED",entityType:"User",entityId:request.user!.id}});return value;});
  return ok(response,user);
}));

userRoutes.post("/users/me/change-password",asyncRoute(async(request,response)=>{
  const input=validate(z.object({currentPassword:z.string().min(1).max(128),newPassword:passwordSchema}),request.body);
  const user=await prisma.user.findUniqueOrThrow({where:{id:request.user!.id}});
  if(!await argon2.verify(user.passwordHash,input.currentPassword))throw new AppError(401,"CURRENT_PASSWORD_INVALID","Current password is incorrect");
  await prisma.$transaction([prisma.user.update({where:{id:user.id},data:{passwordHash:await argon2.hash(input.newPassword,{type:argon2.argon2id})}}),prisma.refreshSession.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}}),prisma.auditLog.create({data:{actorId:user.id,action:"PASSWORD_CHANGED",entityType:"User",entityId:user.id}})]);
  clearAuthCookies(response);return ok(response,{changed:true,signInRequired:true});
}));

userRoutes.get("/users/me/sessions",asyncRoute(async(request,response)=>ok(response,await prisma.refreshSession.findMany({where:{userId:request.user!.id,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true,ipAddress:true,userAgent:true,createdAt:true,expiresAt:true},orderBy:{createdAt:"desc"}}))));

userRoutes.delete("/users/me/sessions/:id",asyncRoute(async(request,response)=>{const result=await prisma.refreshSession.updateMany({where:{id:request.params.id as string,userId:request.user!.id,revokedAt:null},data:{revokedAt:new Date()}});if(!result.count)throw new AppError(404,"SESSION_NOT_FOUND","Session not found");return ok(response,{revoked:true});}));
