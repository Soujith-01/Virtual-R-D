"""
Admin management routes for NUCLEUS AI.

Protected endpoints:
- GET    /api/admin/users               : List all users, counts, and search
- POST   /api/admin/users/{id}/approve  : Approve a pending or rejected researcher
- POST   /api/admin/users/{id}/reject   : Reject a registration request
- POST   /api/admin/users/{id}/suspend  : Suspend an approved account
- POST   /api/admin/users/{id}/reactivate: Reactivate a suspended account
- DELETE /api/admin/users/{id}          : Delete a user account
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from db.store import run_store
from services.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])


class AdminUserListResponse(BaseModel):
    users: List[Dict[str, Any]]
    counts: Dict[str, int]


@router.get("/users", response_model=AdminUserListResponse, summary="List users for admin review")
def list_users(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> AdminUserListResponse:
    """List all registered users with optional status and search filtering."""
    users = run_store.list_users(status=status_filter, search=search)
    counts = run_store.count_users_by_status()
    return AdminUserListResponse(users=users, counts=counts)


@router.post("/users/{user_id}/approve", summary="Approve researcher registration")
def approve_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Approve a researcher account for full platform access."""
    target = run_store.get_user_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    updated = run_store.update_user_status(user_id, "approved")
    return {
        "status": "ok",
        "message": f"User {target.get('full_name')} approved successfully.",
        "user": updated,
    }


@router.post("/users/{user_id}/reject", summary="Reject researcher registration")
def reject_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Reject a researcher's pending registration."""
    target = run_store.get_user_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    updated = run_store.update_user_status(user_id, "rejected")
    return {
        "status": "ok",
        "message": f"User {target.get('full_name')} registration rejected.",
        "user": updated,
    }


@router.post("/users/{user_id}/suspend", summary="Suspend user account")
def suspend_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Suspend an active account."""
    if admin_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend your own administrator account.",
        )

    target = run_store.get_user_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    updated = run_store.update_user_status(user_id, "suspended")
    return {
        "status": "ok",
        "message": f"User {target.get('full_name')} suspended.",
        "user": updated,
    }


@router.post("/users/{user_id}/reactivate", summary="Reactivate user account")
def reactivate_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Reactivate a previously suspended or rejected account."""
    target = run_store.get_user_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    updated = run_store.update_user_status(user_id, "approved")
    return {
        "status": "ok",
        "message": f"User {target.get('full_name')} reactivated.",
        "user": updated,
    }


@router.delete("/users/{user_id}", summary="Delete user account")
def delete_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    """Permanently remove a user record."""
    if admin_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own administrator account.",
        )

    target = run_store.get_user_by_id(user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    success = run_store.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user.",
        )

    return {
        "status": "ok",
        "message": f"User {target.get('full_name')} deleted.",
    }
